-- Migration to add 'sendgrid' to allowed protocols
ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS email_accounts_protocol_check;
ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_protocol_check CHECK (protocol IN ('imap', 'pop3', 'sendgrid'));
