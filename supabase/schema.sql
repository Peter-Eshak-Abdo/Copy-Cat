-- ==============================================================================
-- Office Print Studio - Supabase Database Schema
-- Run this script in the Supabase SQL Editor
-- ==============================================================================

-- 1. Profiles Table (Extends auth.users for Staff & Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Inventory Table (Replaces old Excel sheet)
CREATE TABLE IF NOT EXISTS public.inventory (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'عام',
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(10, 2) DEFAULT 0.00,
    stock_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Transactions Table (ERP Sales & Printing Jobs)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('sale', 'print_service', 'card_service', 'photo_service', 'research')),
    total_amount NUMERIC(10, 2) NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory(name);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================

-- Profiles: Users can view their own profile, Admins can view all
CREATE POLICY "Public profiles can be viewed by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Inventory Policies:
-- Anyone (even anonymous customers on the public storefront) can view products & prices
CREATE POLICY "Public can view inventory items and prices"
    ON public.inventory FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only authenticated staff/admin can insert/update/delete inventory
CREATE POLICY "Staff can insert inventory"
    ON public.inventory FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Staff can update inventory"
    ON public.inventory FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Staff can delete inventory"
    ON public.inventory FOR DELETE
    TO authenticated
    USING (true);

-- Transactions Policies:
-- Only authenticated staff can view and insert transactions
CREATE POLICY "Staff can view transactions"
    ON public.transactions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Staff can insert transactions"
    ON public.transactions FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Trigger for updated_at on inventory
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_modtime
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Seed initial sample inventory
INSERT INTO public.inventory (name, category, price, stock_count, notes)
VALUES 
    ('ورق تصوير A4 دبل إيه 80 جم', 'ورق', 220.00, 45, 'باكو 500 ورقة أصلي'),
    ('ورق كوشيه 300 جم A4', 'ورق', 3.50, 200, 'للبطاقات والشهادات'),
    ('طباعة صورة شخصية 4x6 (عدد 4)', 'خدمات تصوير', 25.00, 999, 'ورق كوداك أصلي'),
    ('طباعة وتغليف كارنيه/بطاقة وجهين A5', 'خدمات بطاقات', 15.00, 999, 'شامل السلوفان الحراري'),
    ('طباعة بحث أكاديمي (لغاية 10 ورقات)', 'خدمات طلابية', 35.00, 999, 'شامل الدبوس والتغليف'),
    ('قلم جاف أزرق روتو', 'أدوات مكتبية', 7.50, 120, 'علبة كرتون'),
    ('ملف شفاف سوستة A4', 'أدوات مكتبية', 12.00, 80, 'بلاستيك مقوى')
ON CONFLICT DO NOTHING;
