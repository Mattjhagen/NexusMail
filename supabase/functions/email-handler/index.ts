import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.7";
import Imap from "npm:imap-simple@5.1.0";
import { simpleParser } from "npm:mailparser@3.6.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      // Fix: Cast Deno to any to avoid type errors regarding 'env' property when Deno types are not loaded
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      // Fix: Cast Deno to any to avoid type errors regarding 'env' property when Deno types are not loaded
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { action, accountId, to, subject, content, config } = await req.json();

    // GET USER (Security Check)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // HELPER: Get Account Credentials
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

    if (action === 'test') {
      // Test credentials provided in 'config' without saving yet
      // Simple SMTP ping
      const transporter = nodemailer.createTransport({
        host: 'smtp.' + config.email.split('@')[1], // Simple guess
        port: 587,
        secure: false,
        auth: { user: config.email, pass: config.password }
      });
      await transporter.verify();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send') {
      const account = await getAccount(accountId);
      
      const transporter = nodemailer.createTransport({
        host: account.host.replace('imap', 'smtp'), // Heuristic for demo
        port: 587,
        secure: false, // Upgrade later with STARTTLS
        auth: {
          user: account.email_address,
          pass: account.auth_token // Encrypted in real app
        }
      });

      const info = await transporter.sendMail({
        from: account.email_address,
        to: to,
        subject: subject,
        text: content
      });

      return new Response(JSON.stringify({ success: true, messageId: info.messageId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'sync') {
      const account = await getAccount(accountId);
      
      const config = {
        imap: {
          user: account.email_address,
          password: account.auth_token,
          host: account.host,
          port: account.port,
          tls: true,
          authTimeout: 10000
        }
      };

      const connection = await Imap.connect(config);
      await connection.openBox('INBOX');

      const searchCriteria = ['UNSEEN'];
      const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };
      const messages = await connection.search(searchCriteria, fetchOptions);

      let count = 0;
      for (const item of messages) {
        const all = item.parts.find((part: any) => part.which === 'TEXT');
        const id = item.attributes.uid;
        const idHeader = "Imap-Id: "+id + "\r\n";
        
        // Basic Parsing
        const parsed = await simpleParser(idHeader + (all ? all.body : ""));
        
        // Insert into DB
        await supabaseClient.from('emails').insert({
          user_id: user.id,
          account_id: accountId,
          remote_id: id.toString(),
          from_address: item.parts[0].body.from ? item.parts[0].body.from[0] : 'unknown',
          subject: item.parts[0].body.subject ? item.parts[0].body.subject[0] : '(No Subject)',
          body_text: parsed.text || '(No Content)',
          received_at: new Date().toISOString(),
          is_read: false
        });
        count++;
      }

      connection.end();
      
      // Update last sync
      await supabaseClient.from('email_accounts').update({ last_sync_at: new Date().toISOString() }).eq('id', accountId);

      return new Response(JSON.stringify({ success: true, count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid Action');

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});