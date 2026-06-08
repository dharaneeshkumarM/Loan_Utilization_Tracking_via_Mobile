# Project Title

**Loan Utilization Tracking via Mobile**

## Problem Statement

Many financial institutions provide loans for education, business, agriculture, and personal needs. However, there is often no efficient system to monitor whether the loan amount is being used for its intended purpose. Manual verification is time-consuming, costly, and prone to errors. A mobile-based loan utilization tracking system is needed to enable borrowers to upload spending details, bills, and proof of utilization, allowing lenders to track and verify loan usage in real time.

## Project Objectives

1. To develop a mobile-based platform for tracking loan utilization.
2. To enable borrowers to upload bills, receipts, and expenditure details.
3. To provide real-time monitoring of loan fund usage.
4. To improve transparency between borrowers and lenders.
5. To reduce fraudulent use of loan amounts.
6. To generate utilization reports and spending summaries.
7. To simplify the loan verification process.

## Module List

1. User Registration and Login Module
2. Loan Application Management Module
3. Loan Utilization Entry Module
4. Receipt/Bill Upload Module
5. Utilization Verification Module
6. Report Generation Module
7. Notification and Alert Module
8. Admin Dashboard Module

## Table List

### User Table

* User_ID (Primary Key)
* Name
* Email
* Mobile_Number
* Password
* Role

### Loan Table

* Loan_ID (Primary Key)
* User_ID (Foreign Key)
* Loan_Type
* Loan_Amount
* Loan_Date
* Loan_Status

### Utilization Table

* Utilization_ID (Primary Key)
* Loan_ID (Foreign Key)
* Expense_Category
* Amount_Spent
* Description
* Date

### Receipt Table

* Receipt_ID (Primary Key)
* Utilization_ID (Foreign Key)
* Receipt_File
* Upload_Date

### Verification Table

* Verification_ID (Primary Key)
* Loan_ID (Foreign Key)
* Verification_Status
* Verified_By
* Remarks

### Report Table

* Report_ID (Primary Key)
* Loan_ID (Foreign Key)
* Total_Spent
* Remaining_Amount
* Report_Date

## Expected Outcome

The system will help financial institutions monitor loan utilization effectively while enabling borrowers to maintain proper records of expenditures through a mobile application. This improves transparency, accountability, and trust in the loan management process.
