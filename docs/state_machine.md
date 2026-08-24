# MERA MAKAN - Financial State Machine

This document defines the strict lifecycle and state transitions for the core entities in the Mera Makan system. Invalid state transitions will be blocked at the database and application levels.

## 1. Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Create Booking
    DRAFT --> RESERVED : Hold Inventory
    RESERVED --> DRAFT : Reservation Timeout
    RESERVED --> BOOKED : Initial Payment Received
    BOOKED --> PAYMENT_IN_PROGRESS : Subsequent Payments Started
    PAYMENT_IN_PROGRESS --> FULLY_COLLECTED : Total Amount Collected
    BOOKED --> FULLY_COLLECTED : Full Amount Paid Initially
    FULLY_COLLECTED --> REGISTERED : Registration Complete
    REGISTERED --> COMPLETED : Documents Handed Over
    
    %% Cancellation / Refund Flows
    DRAFT --> CANCELLED : Admin Action
    RESERVED --> CANCELLED : Admin Action
    BOOKED --> CANCELLED : Customer/Admin Action
    PAYMENT_IN_PROGRESS --> CANCELLED : Customer/Admin Action
    CANCELLED --> REFUNDED : Funds Returned
```

> [!IMPORTANT]
> A booking must reach `FULLY_COLLECTED` before any Royalty or Reward calculation is triggered for the associated channel partner.

## 2. Payment State Machine

```mermaid
stateDiagram-v2
    [*] --> INITIATED : Customer starts checkout
    INITIATED --> PENDING : Waiting for Gateway
    PENDING --> VERIFIED : Gateway Confirms
    VERIFIED --> COLLECTED : Reconciled with Bank
    
    INITIATED --> FAILED : Gateway Error/Timeout
    PENDING --> FAILED : Gateway Error/Timeout
    
    COLLECTED --> REFUNDED : Admin Refund Action
    COLLECTED --> CHARGEBACK : Bank Dispute
```

> [!WARNING]
> Only payments in the `COLLECTED` state can be used as inputs for commission, royalty, and reward ledgers.

## 3. Payout State Machine (For Commissions, Balance Sheet, Royalty, Rewards, ROI)

```mermaid
stateDiagram-v2
    [*] --> PENDING : Event Triggered (e.g. Sale)
    PENDING --> ELIGIBLE : Rule Conditions Met (e.g. Full Cash)
    ELIGIBLE --> APPROVED : Admin Review Complete
    APPROVED --> PROCESSING : Sent to Bank API
    PROCESSING --> PAID : Bank Confirmation
    
    %% Alternative / Exceptional States
    ELIGIBLE --> HELD : Compliance/Admin Hold
    APPROVED --> HELD : Compliance/Admin Hold
    HELD --> ELIGIBLE : Hold Released
    
    PENDING --> REVERSED : Source Transaction Cancelled
    ELIGIBLE --> REVERSED : Source Transaction Cancelled
    
    PROCESSING --> CANCELLED : Bank Rejection/Error
    CANCELLED --> ELIGIBLE : Ready for Retry
```

> [!NOTE]
> All payout transitions must log the `Admin ID` and `Timestamp` for auditing purposes. No financial state can be changed without a verifiable audit trail.
