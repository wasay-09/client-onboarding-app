# Client Onboarding Application — Retirement Plan TPA

A modern, schema-driven web application for a retirement-plan Third-Party Administrator (TPA). This application enables clients to select a retirement plan type, complete a dynamic, customized Plan Design Questionnaire, and download a formatted PDF record of their selections—all executed fully client-side.

This is Phase 1 of a larger client onboarding product.

## 🚀 Key Features

- **Schema-Driven Architecture**: Form fields are declared once in the schema, driving form UI, validation, and PDF generation automatically.
- **Dynamic Conditional Visibility**: Complex validation and visibility logic (e.g., matching parent question responses) ensures users only see and fill out fields relevant to their plan options.
- **Support for Five Major Plan Types**:
  - **401(k) Plan**: Full employer-sponsored defined-contribution plan (includes shared core + detailed design considerations).
  - **403(b) Plan**: For schools, nonprofits, and tax-exempt employers (includes shared core + detailed design considerations).
  - **457(b) Plan**: Deferred compensation plan for governmental and select nonprofit employers (shared core only).
  - **SIMPLE IRA Plan**: Simplified retirement plan for small employers (shared core only).
  - **Solo 401(k) Plan**: For owner-only businesses with no employees (shared core only).
- **Ask Each Detail Once**: The core schema is normalized around reusable sections (such as company details, primary contacts, and plan details) to enable seamless data reuse in future onboarding forms.
- **Client-Side PDF Generation**: Generates clean, well-formatted onboarding summaries as PDF downloads instantly using `@react-pdf/renderer`.
- **Modern UI/UX**: Built with React, Tailwind CSS, and structured form state management using `react-hook-form`.

## 🛠️ Architecture

The codebase leverages a single source-of-truth definition for every questionnaire section and field under `src/schema/`.

```
src/
  ├── types.ts                # TypeScript interfaces (FieldDef, SectionDef, PlanType)
  ├── schema/
  │   ├── plans.ts            # Defines plans and maps them to their respective sections
  │   ├── sharedCore.ts       # Shared core sections (28 fields common to all plans)
  │   ├── designConsiderations.ts # Detailed 401k/403b sections (~38 fields)
  │   └── visibility.ts       # Shared form/PDF visibility, validation, and display rules
  ├── components/
  │   ├── PlanPicker.tsx      # Step 1: Select plan type
  │   ├── QuestionnaireForm.tsx # Step 2: Multi-section form wizard (using React Hook Form)
  │   └── fields/
  │       └── Field.tsx       # Reusable renderer for input types (text, radio, yesno, date, etc.)
  ├── pdf/
  │   ├── QuestionnairePdf.tsx # Layout definition for the PDF report using @react-pdf/renderer
  │   └── generatePdf.tsx      # Handles document build and local download trigger
  └── App.tsx                 # Main application shell coordinating step progression
```

### Dynamic Conditional Visibility
Conditional fields use a `showWhen: { field, equals }` property. If a field's condition (or any of its parent conditions recursively) is not met, the field is:
1. Hidden in the form UI.
2. Excluded from validation.
3. Omitted from the final generated PDF.

The logic is centralized in `src/schema/visibility.ts`, ensuring that the form UI and generated PDF stay 100% in sync.

### "Other" Custom Inputs
For radio options allowing custom responses (`allowOther: true`), the field automatically generates a text field stored as `<name>__other`. The application handles resolving and rendering this selection cleanly in both the form and PDF.

## 💻 Tech Stack

- **Core**: React 19, TypeScript, Vite
- **Form Management**: React Hook Form
- **PDF Export**: @react-pdf/renderer
- **Styling**: Tailwind CSS
- **Linting**: ESLint, TypeScript-ESLint

## 🏃 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (v9 or higher recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd client-onboarding-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

### Build and Lint

To build the static application for production:
```bash
npm run build
```

To run the ESLint checks:
```bash
npm run lint
```

## 🗺️ Roadmap (Future Phases)

1. **Additional Onboarding Forms**: Integration of Plan Setup, FBSI advisor/contact/payroll setup, fund line-up selection, and employee census imports.
2. **Service Agreements**: Dynamic generation of fee schedules and legal agreement boilerplates with pre-filled onboarding fields.
3. **E-Signatures & Submission**: Integration of digital signing and secure automated API submission.
