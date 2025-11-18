import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

print("=" * 50)
print("Fixing possible_rooms field in tbl_modality")
print("=" * 50)

# First, let's see what we're dealing with
print("\n1. Checking current data...")
with connection.cursor() as cursor:
    cursor.execute("SELECT modality_id, possible_rooms FROM tbl_modality WHERE possible_rooms IS NOT NULL LIMIT 5")
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"   ID: {row[0]}, Data: {row[1]}")
    else:
        print("   No data found")

# Now fix it with SQL
print("\n2. Converting column to array type...")
try:
    with connection.cursor() as cursor:
        cursor.execute("""
            ALTER TABLE tbl_modality 
            ALTER COLUMN possible_rooms TYPE text[] 
            USING CASE 
                WHEN possible_rooms IS NULL THEN NULL
                WHEN possible_rooms = '' THEN ARRAY[]::text[]
                WHEN possible_rooms LIKE '[%]' THEN 
                    string_to_array(
                        trim(both '[]' from 
                            replace(replace(possible_rooms, '''', ''), ' ', '')
                        ),
                        ','
                    )
                ELSE 
                    ARRAY[possible_rooms]::text[]
            END;
        """)
    print("   ✓ Conversion successful!")
except Exception as e:
    print(f"   ✗ Error: {e}")
    print("\n   This might mean it's already converted or there's a syntax issue.")

# Verify
print("\n3. Verifying conversion...")
with connection.cursor() as cursor:
    cursor.execute("SELECT modality_id, possible_rooms, pg_typeof(possible_rooms)::text FROM tbl_modality LIMIT 5")
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"   ID: {row[0]}, Data: {row[1]}, Type: {row[2]}")
    else:
        print("   No data found")

print("\n" + "=" * 50)
print("Done! You can now run: python manage.py makemigrations")
print("=" * 50)