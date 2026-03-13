CREATE TABLE IF NOT EXISTS employees (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK(role IN ('개발자','기획자','디자이너','이사 및 경영진')),
    department  TEXT    NOT NULL,
    salary      INTEGER NOT NULL,
    hire_date   TEXT    NOT NULL,
    phone       TEXT,
    email       TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS attendance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id     INTEGER NOT NULL REFERENCES employees(id),
    work_date       TEXT    NOT NULL,
    check_in_time   TEXT,
    check_out_time  TEXT,
    is_late         INTEGER NOT NULL DEFAULT 0,
    is_early_leave  INTEGER NOT NULL DEFAULT 0,
    UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS telegram_users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id       INTEGER NOT NULL UNIQUE,
    telegram_username TEXT,
    full_name         TEXT,
    role              TEXT NOT NULL DEFAULT 'pending'
                      CHECK(role IN ('pending','executive','superadmin')),
    registered_at     TEXT NOT NULL,
    employee_id       INTEGER REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS registration_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_by  INTEGER REFERENCES telegram_users(id),
    created_at  TEXT NOT NULL,
    used_at     TEXT,
    used_by     INTEGER REFERENCES telegram_users(id)
);
