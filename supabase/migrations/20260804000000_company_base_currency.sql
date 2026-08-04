-- Migration: add company base (local operating) currency
-- Purpose: separate a company's local costing currency from buyer/order currency.
ALTER TABLE public.companies
  ADD COLUMN base_currency text NOT NULL DEFAULT 'INR';
