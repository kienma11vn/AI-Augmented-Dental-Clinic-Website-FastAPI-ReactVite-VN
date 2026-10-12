#!/bin/bash
set -e

# Chỉ tạo user replication riêng cho replica
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER replica_user WITH REPLICATION ENCRYPTED PASSWORD 'replica_password';
EOSQL

# Cấp quyền kết nối replication trong pg_hba.conf
echo "host replication replica_user 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"