# 数据库更新说明

## 📋 需要添加的字段

根据您的代码实现，需要在 Supabase 的 `work_logs` 表中添加以下 **4 个新字段**：

### 1. ✅ `check_in_location` (TEXT)
   - **用途**: 存储入职时的完整地址字符串
   - **说明**: 通过坐标反向地理编码获取的完整地址

### 2. ✅ `check_out_location` (TEXT)
   - **用途**: 存储离职时的完整地址字符串
   - **说明**: 通过坐标反向地理编码获取的完整地址

### 3. ✅ `is_outstation` (BOOLEAN)
   - **用途**: 标记是否为外派过夜班次
   - **默认值**: `FALSE`
   - **说明**: 当为 `TRUE` 时，会触发 RM 30 的餐费津贴

### 4. ✅ `day_type` (TEXT)
   - **用途**: 存储日期类型
   - **允许值**: `'weekday'`, `'weekend'`, `'public_holiday'`
   - **说明**: 用于 OT 计算时确定不同的费率

## 🚀 如何执行

### 方法 1: 直接复制 SQL（推荐）

打开 Supabase Dashboard → SQL Editor，然后复制粘贴 `database_migration.sql` 文件中的所有内容，点击运行即可。

### 方法 2: 手动添加字段

如果您想逐个添加，可以在 SQL Editor 中运行以下命令：

```sql
-- 1. 添加入职位置
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS check_in_location TEXT;

-- 2. 添加离职位置
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS check_out_location TEXT;

-- 3. 添加是否外派
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS is_outstation BOOLEAN DEFAULT FALSE;

-- 4. 添加日期类型
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS day_type TEXT 
  CHECK (day_type IS NULL OR day_type IN ('weekday', 'weekend', 'public_holiday'));
```

## 📝 字段说明

| 字段名 | 类型 | 是否必需 | 默认值 | 说明 |
|--------|------|---------|--------|------|
| `check_in_location` | TEXT | 可选 | NULL | 入职完整地址 |
| `check_out_location` | TEXT | 可选 | NULL | 离职完整地址 |
| `is_outstation` | BOOLEAN | 可选 | FALSE | 是否外派过夜 |
| `day_type` | TEXT | 可选 | NULL | 日期类型 |

## ⚠️ 注意事项

1. **不需要添加时间字段**: `check_in_time` 和 `check_out_time` 不需要添加，因为它们与现有的 `clock_in` 和 `clock_out` 字段重复。

2. **现有数据不受影响**: 使用 `ADD COLUMN IF NOT EXISTS` 确保不会影响现有数据，新字段对旧记录为 NULL。

3. **索引已包含**: SQL 脚本会自动创建索引以提高查询性能。

## ✅ 验证

运行 SQL 后，您可以运行以下查询来验证字段是否添加成功：

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'work_logs'
ORDER BY ordinal_position;
```

您应该能看到新添加的 4 个字段。

