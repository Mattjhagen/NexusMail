
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// NOTE: All heavy NPM packages are dynamically imported to prevent boot-time crashes.
// This ensures the function always starts and can report specific errors.

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper: Get IMAP Config
const getImapConfig = (email: string, password: string, host?: string, port?: number) => {
  let finalHost = host;
  let finalPort = port || 993;

  if (!finalHost) {
    if (email.includes('@gmail.com')) finalHost = 'imap.gmail.com';
    else if (email.includes('@outlook.com') || email.includes('@office365.com')) finalHost = 'outlook.office365.com';
    else if (email.includes('@yahoo.com')) finalHost = 'imap.mail.yahoo.com';
    else if (email.includes('@icloud.com')) finalHost = 'imap.mail.me.com';
    else finalHost = `imap.${email.split('@')[1]}`;
  }

  return {
    host: finalHost,
    port: finalPort,
    secure: true,
    auth: {
      user: email,
      pass: password
    },
    logger: false
  };
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // initialize Supabase client
    const supabaseClient = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Parse Body safely
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, accountId, to, subject, content, config: requestConfig } = body;

    // GET USER
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // HELPER: Get Account
    const getAccount = async (id: string) => {
      const { data, error } = await supabaseClient
        .from('email_accounts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !data) throw new Error('Account not found');
      return data;
    };

    // --- HEALTH CHECK --- (Useful for verifying deployment)
    if (action === 'health') {
      return new Response(JSON.stringify({ success: true, message: "Service is healthy" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- TEST CONNECTION ---
    if (action === 'test') {
      if (requestConfig.protocol === 'sendgrid') {
        try {
          const response = await fetch('https://api.sendgrid.com/v3/user/credits', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${requestConfig.password}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            return new Response(JSON.stringify({ success: true, message: "SendGrid Connection Successful" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } else {
            const error = await response.json();
            return new Response(JSON.stringify({ success: false, error: error.errors?.[0]?.message || "Invalid API Key" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, error: `SendGrid check failed: ${err.message}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      try {
        // DYNAMIC IMPORT: ImapFlow
        const { ImapFlow } = await import("npm:imapflow@1.0.150");
        const client = new ImapFlow(getImapConfig(requestConfig.email, requestConfig.password, requestConfig.host, requestConfig.port));

        await client.connect();
        await client.logout();

        return new Response(JSON.stringify({ success: true, message: "IMAP Connection Successful" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err: any) {
        console.error("IMAP Connection Failed:", err);
        const errorMsg = err.message || "Connection failed";
        // Check for common polyfill errors or Proton Bridge issues
        if (errorMsg.includes("process is not defined")) {
          return new Response(JSON.stringify({ success: false, error: "Runtime Error: Node.js compatibility issue (process undefined). Proton Mail Bridge cannot be accessed from cloud." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: false, error: errorMsg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- SEND EMAIL ---
    if (action === 'send') {
      try {
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

        let smtpHost = account.host.replace('imap.', 'smtp.');
        if (account.host.includes('outlook')) smtpHost = 'smtp.office365.com';

        // DYNAMIC IMPORT: Nodemailer
        const nodemailer = await import("npm:nodemailer@6.9.7");
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
          html: content.replace(/\n/g, '<br>')
        });

        return new Response(JSON.stringify({ success: true, messageId: info.messageId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message || "Send failed" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- SYNC EMAILS ---
    if (action === 'sync') {
      try {
        const account = await getAccount(accountId);
        if (account.protocol === 'sendgrid') return new Response(JSON.stringify({ success: true, count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        // DYNAMIC IMPORTS: ImapFlow, Mailparser
        const { ImapFlow } = await import("npm:imapflow@1.0.150");
        const { simpleParser } = await import("npm:mailparser@3.6.5");

        const client = new ImapFlow(getImapConfig(account.email_address, account.auth_token, account.host, account.port));
        let count = 0;

        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
          // Fetch last 5 messages
          // imapflow fetch returns an async generator
          for await (const message of client.fetch('1:*', { envelope: true, source: true, uid: true }, { value: 5, strategy: 'newest' })) {
            const parsed = await simpleParser(message.source);

            // Check existence
            const { data: existing } = await supabaseClient
              .from('emails')
              .select('id')
              .eq('remote_id', message.uid.toString())
              .eq('account_id', accountId)
              .maybeSingle();

            if (!existing) {
              await supabaseClient.from('emails').insert({
                user_id: user.id,
                account_id: accountId,
                remote_id: message.uid.toString(),
                from_address: parsed.from?.text || 'unknown',
                subject: parsed.subject || '(No Subject)',
                body_text: parsed.text || parsed.html || '(No Content)',
                received_at: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
                is_read: false
              });
              count++;
            }
          }
        } finally {
          lock.release();
        }
        await client.logout();

        await supabaseClient.from('email_accounts').update({
          last_sync_at: new Date().toISOString(),
          status: 'connected',
          last_error: null
        }).eq('id', accountId);

        return new Response(JSON.stringify({ success: true, count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (err: any) {
        // Update account status to error
        try {
          if (typeof accountId === 'string') {
            await supabaseClient.from('email_accounts').update({
              status: 'error',
              last_error: err.message
            }).eq('id', accountId);
          }
        } catch (dbErr) { console.error("Failed to update account error status:", dbErr); }

        console.error("Sync Failed:", err);
        return new Response(JSON.stringify({ success: false, error: err.message || "Sync failed" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid Action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("Email Handler Critical Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
