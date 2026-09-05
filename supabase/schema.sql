-- ==============================================================================
-- Copy-Cat Document Solutions - Supabase Database Schema
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

-- 2. Inventory / Products Table (Syncs with Customer Storefront & POS)
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

-- 3. Transactions Table (ERP Sales, Orders & Printing Jobs)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale', 'print_service', 'card_service', 'photo_service', 'research', 'whatsapp_order')),
    total_amount NUMERIC(10, 2) NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory(name);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Security Policies:

-- Profiles:
CREATE POLICY "Profiles can be read by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Inventory:
-- Anyone (public customers visiting the storefront) can view available items and prices
CREATE POLICY "Public customer storefront can read inventory items"
    ON public.inventory FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only authenticated staff/admin can insert/update/delete inventory
CREATE POLICY "Authenticated staff can insert inventory items"
    ON public.inventory FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated staff can update inventory items"
    ON public.inventory FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated staff can delete inventory items"
    ON public.inventory FOR DELETE
    TO authenticated
    USING (true);

-- Transactions:
CREATE POLICY "Staff can view and manage transactions"
    ON public.transactions FOR ALL
    TO authenticated
    USING (true);

-- Trigger for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_inventory_modtime
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- Seed initial products for Copy-Cat
INSERT INTO public.inventory (name, category, price, stock_count, notes)
VALUES 
    ('طباعة وتغليف بطاقة / كارنيه وش وضهر A5', 'خدمات بطاقات', 15.00, 999, 'سلوفان حراري فوري لحماية الكروت مقاس A5'),
    ('استوديو الصور الشخصية 4x6 (عدد 4 صور)', 'خدمات تصوير', 25.00, 999, 'عزل خلفية فوري + طباعة ورق كوداك أصلي'),
    ('استوديو الصور الشخصية 4x6 (عدد 8 صور)', 'خدمات تصوير', 45.00, 999, 'عرض الاستوديو المميز لتقديمات المدارس والجامعات'),
    ('طباعة وتجليد بحث أكاديمي / جامعي (حتى 10 صفحات)', 'خدمات طلابية', 35.00, 999, 'تنسيق متكامل مع الغلاف الرسمي والفهرس والمراجع'),
    ('تصوير وتفتيح مستندات ومذكرات (وجه واحد)', 'خدمات طلابية', 1.00, 999, 'أعلى دقة مع توفير الحبر ونقاء فائق للنصوص'),
    ('ورق تصوير A4 دبل إيه (Double A) 80 جم', 'ورق وطباعة', 220.00, 45, 'باكو 500 ورقة أصلي فائق البياض'),
    ('ورق كوشيه 300 جم A4 فاخر', 'ورق وطباعة', 3.50, 200, 'مخصص للشهادات، الأغلفة، والبطاقات الفاخرة'),
    ('ملف شفاف بسوستة A4 مقوى', 'أدوات مكتبية', 12.00, 80, 'خامة بلاستيك ممتازة لحفظ المستندات'),
    ('قلم جاف أزرق روتو أصلي', 'أدوات مكتبية', 7.50, 120, 'كتابة ناعمة وانسيابية'),
    ('دوسيه بلاستيك كبسولة لحفظ الأوراق', 'أدوات مكتبية', 15.00, 65, 'ألوان متعددة ومقاوم للماء')
ON CONFLICT DO NOTHING;
