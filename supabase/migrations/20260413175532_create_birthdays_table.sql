/*
  # Create birthdays table

  1. New Tables
    - `birthdays`
      - `id` (uuid, primary key)
      - `name` (text) - Full name of the person
      - `date` (text) - Birthday date in DD-MM format
      - `group_id` (text) - WhatsApp group serialized ID
      - `group_name` (text) - WhatsApp group display name
      - `message` (text, nullable) - Optional custom birthday message
      - `last_reminder_year` (integer, nullable) - Year when last reminder was sent
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `birthdays` table
    - Add policy for service role full access (bot uses service role)
    - Add policy for anon role read/write access (web UI uses anon key behind internal network)
*/

CREATE TABLE IF NOT EXISTS birthdays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date text NOT NULL,
  group_id text NOT NULL DEFAULT '',
  group_name text NOT NULL DEFAULT '',
  message text,
  last_reminder_year integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE birthdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access"
  ON birthdays
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert"
  ON birthdays
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update"
  ON birthdays
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete"
  ON birthdays
  FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Anon can select all birthdays"
  ON birthdays
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert birthdays"
  ON birthdays
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update birthdays"
  ON birthdays
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete birthdays"
  ON birthdays
  FOR DELETE
  TO anon
  USING (true);
