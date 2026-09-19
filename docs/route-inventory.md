# Route Inventory (T00)

Access: PUB=public, SES=any session, ROLE=list. Nav = linked from UI. Works = VERIFIED MANUALLY unless noted.

## Pages
| Route | Access | Nav | Works | Notes |
|---|---|---|---|---|
| `/[locale]` (home) | PUB | header/footer | yes | ISR 60s |
| `/catalog`, `/cart`, `/checkout`, `/tracking`, `/branches` | PUB | header | yes | checkout needs cart items |
| `/pos` | PUB (GAP T03) | header/admin | yes | no login required |
| `/admin/login` | PUB | — | yes | demo creds prefilled |
| `/admin` | SES | sidebar | yes | counts only |
| `/admin/orders` | SES | sidebar | yes | unified orders+POS view |
| `/admin/products` | SES | sidebar | yes | CRUD + CSV export |
| `/admin/inventory` | SES | sidebar/dashboard | yes | transfers approve/reject |
| `/admin/purchasing` | SES | sidebar/dashboard | yes | PO create/receive/cancel |
| `/admin/customers` | SES | sidebar | yes | CRUD + loyalty |
| `/admin/accounting` | SES (should be FINANCE+) | sidebar/dashboard | yes | expenses CRUD |
| `/admin/payroll` | SES (should be FINANCE+) | sidebar | yes | runs approve/pay |
| `/admin/reports` | SES | sidebar | yes | computed from data |
| `/admin/notifications` | SES | header bell | yes | read/delete |
| `/admin/settings` | SES (should be SUPER_ADMIN) | sidebar | partial | display-only, no save |
| `/admin/users` | SES (should be SUPER_ADMIN) | sidebar? | yes | full CRUD — CHECK sidebar link |
| `/admin/employees` | SES | sidebar | yes | CRUD |
| `/admin/branches` | MISSING PAGE | — | no | BranchManager lives inside settings; T12/T34 adds page |

## APIs
| Route | Access | Notes |
|---|---|---|
| `/api/auth/[...nextauth]` | PUB | credentials provider |
| `/api/orders/create` | PUB | oversell allowed (G4) |
| `/api/orders/track` | PUB | by number/phone/tracking |
| `/api/pos/products` | PUB (GAP T03) | flagship stock only |
| `/api/pos/sale` | PUB (GAP T03) | strict stock, offline-unsafe (no idempotency) |
| `/api/pos/customer` GET/POST | PUB (GAP T03) | lookup + quick create |
| `/api/admin/orders` POST | SES | manual order create |
| `/api/admin/orders/[id]` PATCH | SES | status change, no state machine |
| `/api/admin/products` POST / `[id]` PATCH+DELETE | SES | flagship-only inventory |
| `/api/admin/transfers` POST / `[id]` approve/reject | SES | moves stock, no $transaction |
| `/api/admin/purchase-orders` POST / `[id]` cancel / `[id]/receive` | SES | receive adds stock |
| `/api/admin/expenses` POST / `[id]` PATCH+DELETE | SES | no role gate |
| `/api/admin/payroll-runs` POST / `[id]` approve/pay | SES | no role gate |
| `/api/admin/notifications` GET / `[id]` PATCH+DELETE / `read-all` | SES | — |
| `/api/admin/{users,employees,customers,categories,brands,branches,suppliers}` | SES | GET/POST/PATCH/DELETE, no role gate |
| `/api/admin/upload` | SES | Cloudinary, 10MB, type-checked |

## Dead links / gaps
- Sidebar: verify `users` link presence (UsersManager exists + page exists).
- No `/admin/branches`, `/admin/audit`, `/admin/content`, returns, shifts, stocktake, coupons, settlements pages (T34).
- No product detail page `/catalog/[slug]` (T19). No webhooks (T23/T24). No customer portal (T27).

## Hardcoded business values (for T12 settings)
Phones: `03 5926908`/`035926908` (header/hero/footer/branches/POS receipt), WhatsApp `201001234567` (ProductCard) vs `0122 422 6876` (POS/floaters), wallet `01001234567` + IPA `sports.champions@instapay` (payments), demo creds in LoginForm. VAT `0.14`/`14%` (~15 spots). Manager PINs `1234`/`9999` (posStore + POS UI hint). Loyalty `floor(total/10)` (pos/sale:126). Low-stock `5` (transfers, products, receive routes). Discount threshold `>100` (posStore:125). Delivery default fee `30.0` (schema:339). Branch names `الإبراهيمية`/`سموحة` string-matched in ProductsManager `stockOf`.
