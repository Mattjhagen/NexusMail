
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.7";
import Imap from "npm:imap-simple@5.1.0";
import { simpleParser } from "npm:mailparser@3.6.5";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper to determine IMAP config based on email
const getImapConfig = (email: string, password: string, host?: string, port?: number) => {
  let finalHost = host;
  let finalPort = port || 993;

  // Auto-detect common providers if host not provided
  if (!finalHost) {
    if (email.includes('@gmail.com')) finalHost = 'imap.gmail.com';
    else if (email.includes('@outlook.com') || email.includes('@office365.com')) finalHost = 'outlook.office365.com';
    else if (email.includes('@yahoo.com')) finalHost = 'imap.mail.yahoo.com';
    else if (email.includes('@icloud.com')) finalHost = 'imap.mail.me.com';
    else finalHost = `imap.${email.split('@')[1]}`; // Fallback guess
  }

  return {
    imap: {
      user: email,
      password: password,
      host: finalHost,
      port: finalPort,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false } // Helpful for some self-signed certs, though less secure
    }
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { action, accountId, to, subject, content, config: requestConfig } = await req.json();

    // GET USER
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // HELPER: Get Account from DB
    const getAccount = async (id: string) => {
      const { data, error } = await supabaseClient
        .from('email_accounts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !data) throw new Error('Account not found or access denied');
      return data;
    };

    // --- ACTION: TEST CONNECTION ---
    if (action === 'test') {
      console.log(`Testing connection for ${requestConfig.email}`);

      if (requestConfig.protocol === 'sendgrid') {
        // Test SendGrid API Key
        const response = await fetch('https://api.sendgrid.com/v3/user/credits', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${requestConfig.password}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          return new Response(JSON.stringify({ success: true, message: "SendGrid Connection Successful" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          const error = await response.json();
          return new Response(JSON.stringify({ success: false, error: error.errors?.[0]?.message || "Invalid API Key" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      const imapConfig = getImapConfig(requestConfig.email, requestConfig.password, requestConfig.host, requestConfig.port);

      try {
        const connection = await Imap.connect(imapConfig);
        await connection.openBox('INBOX');
        connection.end();
        return new Response(JSON.stringify({ success: true, message: "IMAP Connection Successful" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        console.error("IMAP Connection Failed:", err);
        return new Response(JSON.stringify({ success: false, error: err.message || "Connection refused" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // --- ACTION: SEND EMAIL ---
    if (action === 'send') {
      const account = await getAccount(accountId);

      if (account.protocol === 'sendgrid') {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${account.auth_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: account.email_address },
            subject: subject,
            content: [
              { type: 'text/plain', value: content },
              { type: 'text/html', value: content.replace(/\n/g, '<br>') }
            ]
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`SendGrid Error: ${JSON.stringify(errorData)}`);
        }

        return new Response(JSON.stringify({ success: true, messageId: `sg-${Date.now()}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Heuristic for SMTP based on IMAP host
      let smtpHost = account.host.replace('imap.', 'smtp.');
      if (account.host.includes('outlook')) smtpHost = 'smtp.office365.com';

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 587,
        secure: false,
        auth: {
          user: account.email_address,
          pass: account.auth_token
        }
      });

      const info = await transporter.sendMail({
        from: account.email_address,
        to: to,
        subject: subject,
        text: content,
        html: content.replace(/\n/g, '<br>') // Basic HTML conversion
      });

      return new Response(JSON.stringify({ success: true, messageId: info.messageId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- ACTION: SYNC (FETCH) EMAILS ---
    if (action === 'sync') {
      const account = await getAccount(accountId);

      // Skip sync for SendGrid
      if (account.protocol === 'sendgrid') {
        return new Response(JSON.stringify({ success: true, count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const imapConfig = getImapConfig(account.email_address, account.auth_token, account.host, account.port);

      let connection;
      try {
        connection = await Imap.connect(imapConfig);
        await connection.openBox('INBOX');

        // Fetch last 10 unseen messages or just last 10 messages if everything is seen
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
          bodies: ['HEADER', 'TEXT', ''], // Empty string gets full body for parser
          markSeen: false, // Don't mark as read yet, let user do it in UI
          struct: true
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        // Limit to 5 newest to prevent timeout in Edge Function
        const recentMessages = messages.slice(-5);

        let count = 0;
        for (const item of recentMessages) {
          const allPart = item.parts.find((part: any) => part.which === '');
          const id = item.attributes.uid;
          const idHeader = "Imap-Id: " + id + "\r\n";

          if (allPart) {
            const parsed = await simpleParser(allPart.body);

            // Check if email already exists to avoid duplicates
            const { data: existing } = await supabaseClient
              .from('emails')
              .select('id')
              .eq('remote_id', id.toString())
              .eq('account_id', accountId)
              .maybeSingle();

            if (!existing) {
              await supabaseClient.from('emails').insert({
                user_id: user.id,
                account_id: accountId,
                remote_id: id.toString(),
                from_address: parsed.from?.text || 'unknown',
                subject: parsed.subject || '(No Subject)',
                body_text: parsed.text || parsed.html || '(No Content)',
                received_at: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
                is_read: false
              });
              count++;
            }
          }
        }

        connection.end();

        // Update last sync status
        await supabaseClient.from('email_accounts').update({
          last_sync_at: new Date().toISOString(),
          status: 'connected',
          last_error: null
        }).eq('id', accountId);

        return new Response(JSON.stringify({ success: true, count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (connErr: any) {
        // Update account status to error
        await supabaseClient.from('email_accounts').update({
          status: 'error',
          last_error: connErr.message
        }).eq('id', accountId);

        throw connErr;
      }
    }

    throw new Error('Invalid Action');

  } catch (err: any) {
    console.error("Email Handler Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
