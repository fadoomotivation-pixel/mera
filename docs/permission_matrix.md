# MERA MAKAN - Permission Matrix

This matrix defines the strict Role-Based Access Control (RBAC) enforced at the API layer.

| Module / Action | Super Admin | Finance Admin | Ops Admin | Compliance | Support | Channel Partner | Customer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Inventory (Projects/Plots)** |
| Create / Edit | ✔️ | ❌ | ✔️ | ❌ | ❌ | ❌ | ❌ |
| View All | ✔️ | ✔️ | ✔️ | ✔️ | ✔️ | ❌ | ❌ |
| **Bookings** |
| Create Booking | ✔️ | ❌ | ✔️ | ❌ | ❌ | ❌ | ❌ |
| View Own | - | - | - | - | - | ✔️ (Referred) | ✔️ |
| View All | ✔️ | ✔️ | ✔️ | ✔️ | ✔️ | ❌ | ❌ |
| **Payments / Collections** |
| Make Payment | - | - | - | - | - | ❌ | ✔️ |
| Verify / Collect | ✔️ | ✔️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Issue Refund / Adj | ✔️ | ✔️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Payouts & Ledgers** |
| View Payouts (Global) | ✔️ | ✔️ | ❌ | ✔️ | ❌ | ❌ | ❌ |
| View Payouts (Own) | - | - | - | - | - | ✔️ | ❌ |
| Approve Payouts | ✔️ | ✔️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Run Closing Cycle | ✔️ | ✔️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate Royalty Snapshot | ✔️ | ✔️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Business Rules** |
| View Rules | ✔️ | ✔️ | ❌ | ✔️ | ❌ | ❌ | ❌ |
| Modify Rules | ✔️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit Logs** |
| View Logs | ✔️ | ❌ | ❌ | ✔️ | ❌ | ❌ | ❌ |
| Delete Logs | ❌ (Blocked) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Implementation Notes
- **Server-Side Enforcement**: UI hiding is insufficient. Every API request must validate the JWT role against this matrix.
- **Data Scoping**: Customers and Partners inherently have "View Own" access. The API must append `WHERE user_id = ?` dynamically based on the JWT token.
- **Immutability**: Audit logs cannot be deleted by *any* role, including Super Admin, to ensure financial integrity.
