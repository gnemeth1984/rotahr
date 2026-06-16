# Commands to run on your machine (in order)

## 1. Install new packages
```powershell
cd C:\Users\User\rotahr
npm install bcryptjs @types/bcryptjs chrono-node
```

## 2. Run new migration (adds Business, Employee, Department, Shift, EmployeeTimeOff tables + password/businessId to User)
```powershell
npx prisma migrate dev --name workforce-backend
```

## 3. Seed Christy's account + Christy's Bar business
```powershell
npx prisma db seed
```

## 4. Restart dev server
```powershell
npm run dev
```

---

## What was added

### New DB tables
- `Business` — top-level business account
- `Employee` — staff members (separate from User/login accounts)
- `Department` — Bar, Kitchen, etc.
- `Shift` — scheduled shifts per employee
- `EmployeeTimeOff` — time-off requests per employee

### New fields on User
- `password` — for email+password login
- `businessId` — links manager to their business

### New API routes
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/business/create | ADMIN |
| GET | /api/business/:id | ADMIN, MANAGER |
| POST | /api/manager/add | ADMIN |
| GET | /api/manager/list | ADMIN, MANAGER |
| POST | /api/employee/add | ADMIN, MANAGER |
| GET | /api/employee/list | ADMIN, MANAGER |
| GET | /api/employee/:id | ADMIN, MANAGER |
| PUT | /api/employee/:id | ADMIN, MANAGER |
| POST | /api/department/create | ADMIN, MANAGER |
| GET | /api/department/list | ADMIN, MANAGER |
| POST | /api/shifts/create | ADMIN, MANAGER |
| GET | /api/shifts/list | ADMIN, MANAGER |
| PUT | /api/shifts/:id | ADMIN, MANAGER |
| POST | /api/timeoff/request | ADMIN, MANAGER |
| GET | /api/timeoff/pending | ADMIN, MANAGER |
| PUT | /api/timeoff/:id/approve | ADMIN, MANAGER |
| PUT | /api/timeoff/:id/reject | ADMIN, MANAGER |
| POST | /api/ai/suggest-replacement | ADMIN, MANAGER |

### Christy's login
- Email: christywalsh@gmail.com
- Password: password123
- Role: MANAGER
- Business: Christy's Bar
