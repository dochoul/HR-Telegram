# Nabia HR Telegram Bot

Nabia 경영진 전용 HR 데이터 조회 텔레그램 챗봇

## 주요 기능

### 1. 초대 코드 기반 인증 시스템

봇 접근 권한을 초대 코드로 관리합니다. 권한은 3단계로 나뉩니다.

| 권한 | 설명 | 획득 방법 |
|---|---|---|
| `pending` | 미인증 상태 (기본값) | 봇 최초 접속 시 |
| `executive` | 경영진 — HR 데이터 조회 가능 | 슈퍼어드민이 발급한 초대 코드 입력 |
| `superadmin` | 최고 관리자 — 모든 기능 사용 가능 | `.env`의 `SUPERADMIN_CODE` 입력 |

- `/register` 명령어로 인증 절차를 시작하며, 코드를 별도 메시지로 입력하거나 `/register [코드]`로 즉시 인증할 수 있습니다.
- `/cancel`로 진행 중인 인증을 취소할 수 있습니다.
- 초대 코드는 1회성이며, 사용 후 자동으로 소멸됩니다.

### 2. 직원 정보 관리

100명의 Mock 직원 데이터(한국어 이름, 4개 직급, 14개 부서)를 자동 생성하여 조회할 수 있습니다.

| 기능 | 명령어 | 설명 |
|---|---|---|
| 직원 목록 | `/employees` | 전체 직원 목록을 페이지네이션(10명 단위)으로 조회. 인라인 키보드로 이전/다음 페이지 이동 |
| 직원 검색 | `/employee [이름]` | 이름 부분 일치 검색. 직급, 부서, 연봉, 입사일, 연락처 표시 (최대 20명) |

**직급 종류**: 개발자, 기획자, 디자이너, 이사 및 경영진

**부서 종류**:
- 개발자: 프론트엔드팀, 백엔드팀, 모바일팀, 인프라팀, 데이터팀
- 기획자: 서비스기획팀, 전략기획팀, PM팀
- 디자이너: UX팀, UI팀, 브랜드팀
- 이사 및 경영진: 경영지원실, 전략실, CTO실

### 3. 연봉 통계 및 조회

| 기능 | 명령어 | 설명 |
|---|---|---|
| 직급별 통계 | `/salary` | 직급별 평균/최소/최대 연봉을 만원 단위로 표시 |
| 개인 연봉 | `/salary [이름]` | 특정 직원의 연봉을 원 단위 및 만원 단위로 표시 |

연봉 범위 (시드 데이터 기준):
- 개발자: 4,500만원 ~ 9,000만원
- 기획자: 4,000만원 ~ 7,000만원
- 디자이너: 3,800만원 ~ 6,500만원
- 이사 및 경영진: 8,000만원 ~ 2억원

### 4. 출퇴근 관리

90일치 출퇴근 Mock 데이터를 자동 생성합니다 (주말 제외). 출근 기준 시간은 `.env`의 `WORK_START_TIME`(기본 09:00)으로 설정됩니다.

| 기능 | 명령어 | 설명 |
|---|---|---|
| 오늘 현황 | `/attendance` | 오늘 출퇴근 현황 + 출근/지각/결근 인원 요약 (최대 30명 표시) |
| 날짜별 현황 | `/attendance [YYYY-MM-DD]` | 특정 날짜의 출퇴근 현황 조회 |
| 지각자 | `/late` | 오늘 지각자 목록 (출근 시간순 정렬) |
| 결근자 | `/absent` | 오늘 결근자 목록 (직급, 부서 표시) |
| 월간 리포트 | `/report [이름]` | 최근 30일 출퇴근 리포트 — 출근일수, 지각 횟수, 조퇴 횟수, 평균 출근시간 (최대 5명) |

출퇴근 데이터 분포:
- 정상 출근(85%): 08:30 ~ 09:00
- 지각(10%): 09:01 ~ 10:30
- 결근(5%): 출근 기록 없음
- 퇴근: 18:00 ~ 19:30

### 5. HR 통계 대시보드

| 기능 | 명령어 | 설명 |
|---|---|---|
| 전체 통계 | `/stats` | 전체 직원 수, 평균 연봉, 직급별 분포, 오늘 출퇴근 요약을 한눈에 표시 |

### 6. 자연어 대화 인터페이스

슬래시 명령어 없이 일반 텍스트로 HR 데이터를 조회할 수 있습니다. 정규식 기반 의도 파악(Intent Detection)과 직원 이름 자동 인식을 지원합니다.

**지원하는 자연어 패턴:**

| 카테고리 | 예시 입력 | 동작 |
|---|---|---|
| 개인 연봉 | `"김민서 연봉"`, `"이예나 급여"` | 해당 직원 연봉 정보 표시 |
| 연봉 통계 | `"연봉 통계"`, `"급여 현황"` | 직급별 연봉 통계 표시 |
| 지각자 | `"오늘 지각자"`, `"늦은 사람"` | 오늘 지각자 목록 표시 |
| 결근자 | `"결근자"`, `"안 나온 사람"` | 오늘 결근자 목록 표시 |
| 출퇴근 현황 | `"출퇴근"`, `"근태"` | 오늘 출퇴근 현황 표시 |
| 날짜별 출퇴근 | `"2026-03-10 출퇴근"` | 해당 날짜 출퇴근 현황 표시 |
| 월간 리포트 | `"김철수 리포트"`, `"박지우 근태"` | 해당 직원 월간 출퇴근 리포트 |
| 직원 검색 | `"이예나 정보"`, `"김민서 누구"` | 직원 상세 정보 표시 |
| 직원 목록 | `"직원 목록"`, `"전체 직원"` | 페이지네이션 직원 목록 |
| 통계 | `"통계"`, `"HR 현황"` | HR 통계 대시보드 |

**의도 감지(Intent Detection):** 텍스트에 직원 이름이 포함되면 문맥에 따라 자동으로 필요한 정보를 반환합니다.

| 감지 의도 | 키워드 | 반환 정보 |
|---|---|---|
| 연봉 | 연봉, 급여, 월급 | 연봉 금액 |
| 입사일 | 입사, 합류, 언제 들어 | 입사일 |
| 부서 | 부서, 소속, 팀 | 부서 및 직급 |
| 연락처 | 전화, 이메일, 번호 | 전화번호, 이메일 |
| 직급 | 직급, 직책, 포지션 | 직급 |
| 일반 | (기타) | 전체 프로필 |

### 7. 슈퍼어드민 관리 기능

| 기능 | 명령어 | 설명 |
|---|---|---|
| 초대 코드 생성 | `/add_executive` | 1회용 경영진 초대 코드 생성 (형식: `nabia-exec-[타임스탬프]-[랜덤]`) |
| 권한 회수 | `/revoke [telegram_id]` | 특정 사용자의 권한을 `pending`으로 변경. 슈퍼어드민은 회수 불가 |
| 사용자 목록 | `/users` | 등록된 모든 사용자의 이름, 아이디, 권한, 등록일 표시 |

## 기술 스택

- **런타임**: Node.js + TypeScript (tsx)
- **봇 프레임워크**: grammY
- **데이터베이스**: SQLite3 (better-sqlite3, WAL 모드)
- **시드 데이터**: @faker-js/faker (한국어 로케일)

## 데이터베이스 스키마

| 테이블 | 설명 | 주요 컬럼 |
|---|---|---|
| `employees` | 직원 정보 | name, role, department, salary, hire_date, phone, email, is_active |
| `attendance` | 출퇴근 기록 | employee_id(FK), work_date, check_in_time, check_out_time, is_late, is_early_leave |
| `telegram_users` | 봇 사용자 | telegram_id, telegram_username, full_name, role(pending/executive/superadmin) |
| `registration_codes` | 초대 코드 | code, role, used, created_by(FK), used_by(FK) |

## 텔레그램 봇 토큰 발급 방법

1. 텔레그램에서 [@BotFather](https://t.me/BotFather)를 검색하여 대화를 시작합니다.
2. `/newbot` 명령어를 입력합니다.
3. 봇 이름을 입력합니다 (예: `Nabia HR Bot`).
4. 봇 사용자명을 입력합니다 (예: `nabia_hr_bot`). `_bot`으로 끝나야 합니다.
5. BotFather가 발급한 토큰을 복사합니다 (예: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`).
6. 프로젝트 루트에 `.env` 파일을 만들고 토큰을 설정합니다.

## 환경 변수

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `BOT_TOKEN` | 텔레그램 봇 토큰 (필수) | — |
| `SUPERADMIN_CODE` | 슈퍼어드민 등록 코드 | `nabia-super-2026-xxxx` |
| `DB_PATH` | SQLite DB 파일 경로 | `data/nabia_hr.db` |
| `COMPANY_NAME` | 회사명 (봇 메시지에 표시) | `Nabia` |
| `WORK_START_TIME` | 출근 기준 시간 | `09:00` |
| `WORK_END_TIME` | 퇴근 기준 시간 | `18:00` |

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열고 BOT_TOKEN과 SUPERADMIN_CODE를 설정

# 3. 봇 실행 (DB 자동 생성 + 시드 데이터 삽입)
npm start

# 개발 모드 (파일 변경 시 자동 재시작)
npm run dev

# 시드 데이터만 별도 생성
npm run seed
```

## 최초 설정

1. `.env`의 `SUPERADMIN_CODE` 값을 안전한 코드로 변경
2. 봇 실행 후 텔레그램에서 `/start` 입력
3. `/register` → SUPERADMIN_CODE 입력 → 슈퍼어드민 등록
4. `/add_executive`로 경영진 초대 코드 생성
5. 해당 코드를 경영진에게 전달

## 명령어 요약

### 공개
| 명령어 | 설명 |
|---|---|
| `/start` | 봇 소개 |
| `/help` | 권한에 따라 사용 가능한 명령어 목록 표시 |
| `/register` | 초대 코드 인증 (대화형 또는 `/register [코드]`) |
| `/cancel` | 진행 중인 인증 취소 |

### 경영진 전용
| 명령어 | 설명 |
|---|---|
| `/employees` | 직원 목록 (인라인 페이지네이션) |
| `/employee [이름]` | 직원 검색 (이름 부분 일치) |
| `/salary` | 직급별 연봉 통계 |
| `/salary [이름]` | 개인 연봉 조회 |
| `/attendance` | 오늘 출퇴근 현황 |
| `/attendance [YYYY-MM-DD]` | 특정 날짜 출퇴근 현황 |
| `/late` | 오늘 지각자 목록 |
| `/absent` | 오늘 결근자 목록 |
| `/report [이름]` | 월간 출퇴근 리포트 (최근 30일) |
| `/stats` | 전체 HR 통계 대시보드 |

### 슈퍼어드민 전용
| 명령어 | 설명 |
|---|---|
| `/add_executive` | 경영진 1회용 초대 코드 생성 |
| `/revoke [telegram_id]` | 사용자 권한 회수 |
| `/users` | 등록 사용자 전체 목록 |

## 프로젝트 구조

```
src/
├── index.ts              # 진입점 — 봇 생성, 핸들러 등록, 그레이스풀 셧다운
├── config.ts             # 환경 변수 로딩 및 검증
├── database/
│   ├── connection.ts     # SQLite 연결 관리 (WAL 모드, FK 활성화)
│   ├── schema.sql        # 테이블 DDL (employees, attendance, telegram_users, registration_codes)
│   └── seed.ts           # Mock 데이터 생성 (직원 100명, 90일치 출퇴근)
├── models/
│   ├── employee.ts       # Employee 인터페이스
│   ├── attendance.ts     # Attendance 인터페이스
│   └── user.ts           # TelegramUser, RegistrationCode 인터페이스
├── repositories/
│   ├── employee-repo.ts  # 직원 CRUD, 연봉 통계, 이름 검색, 텍스트 내 이름 감지
│   ├── attendance-repo.ts # 출퇴근 조회, 지각/결근 필터, 월간 리포트 집계
│   └── user-repo.ts      # 사용자 등록, 권한 관리, 초대 코드 생성/검증
├── handlers/
│   ├── auth.ts           # /start, /help, /register, /cancel 핸들러
│   ├── employee.ts       # /employees, /employee 핸들러 + 페이지네이션 콜백
│   ├── salary.ts         # /salary 핸들러
│   ├── attendance.ts     # /attendance, /late, /absent, /report, /stats 핸들러
│   ├── admin.ts          # /add_executive, /revoke, /users 핸들러
│   └── natural.ts        # 자연어 텍스트 라우터 — 정규식 매칭 + 의도 감지 + 폴백
├── middlewares/
│   └── auth.ts           # requireExecutive, requireSuperadmin 권한 검증 미들웨어
└── utils/
    ├── formatters.ts     # 연봉(만원), 날짜(한국식), 시간, HTML 이스케이프 포맷터
    └── keyboards.ts      # 인라인 페이지네이션 키보드 빌더 (10명 단위)
```
