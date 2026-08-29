import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { SUPPORT } from "@/lib/support";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy  -  Testum NEET CBT Test Series" },
      { name: "description", content: "How Testum collects, uses, stores and protects the personal data of NEET aspirants using our CBT test platform." },
      { property: "og:title", content: "Privacy Policy  -  Testum" },
      { property: "og:description", content: "How Testum handles your personal data, test attempts and payment information." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="8 August 2026">
      <LegalSection title="1. Who we are">
        Testum is an online NEET CBT test-series platform. This policy explains what information we
        collect when you create an account, purchase a plan or attempt a test, and how we use it.
      </LegalSection>
      <LegalSection title="2. Information we collect">
        <ul>
          <li><b>Account details</b>  -  full name, email address, mobile number and your class (11th, 12th or dropper), provided by you at sign-up.</li>
          <li><b>Test activity</b>  -  your attempts, selected options, time spent per question, scores and generated performance analysis.</li>
          <li><b>Payment details</b>  -  order amount, plan purchased and the payment reference returned by our payment partner. We never see or store your card, UPI or bank credentials.</li>
          <li><b>Technical data</b>  -  basic device and browser information needed to keep your session secure and the test player stable.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. How we use your information">
        <ul>
          <li>To create and secure your account and keep you signed in.</li>
          <li>To deliver the tests included in the plan you purchased and to unlock content you are entitled to.</li>
          <li>To save your attempts so you can resume an unfinished test and review results later.</li>
          <li>To generate your performance report, weak-topic analysis and downloadable PDF.</li>
          <li>To provide support over Telegram or email when you contact us.</li>
        </ul>
      </LegalSection>
      <LegalSection title="4. AI-generated analysis">
        Your anonymised attempt statistics (subject and chapter-wise correct, incorrect and skipped counts) are
        sent to our AI provider to produce your performance summary and study plan. Your name, email, mobile
        number and payment details are never included in that request.
      </LegalSection>
      <LegalSection title="5. Payments">
        Payments are processed by Cashfree Payments. Your payment information is handled directly by them under
        their own privacy policy. Testum only receives the order status and reference needed to unlock your plan.
      </LegalSection>
      <LegalSection title="6. Data sharing">
        We do not sell your personal data. We share it only with the service providers that run the platform  - 
        our hosting and database provider, our AI analysis provider and our payment gateway  -  strictly to
        operate the service, or when required by law.
      </LegalSection>
      <LegalSection title="7. Data retention">
        Account and attempt data is retained for as long as your account is active so your history and reports
        remain available. You may ask us to delete your account and associated data at any time.
      </LegalSection>
      <LegalSection title="8. Your rights">
        You can access, correct or request deletion of your personal data, and ask for a copy of your test
        history. Write to us using the contact details below and we will respond within a reasonable period.
      </LegalSection>
      <LegalSection title="9. Security">
        Access to your data is protected by authentication and row-level database rules so that one student
        cannot read another student's attempts, results or orders. Please keep your password confidential.
      </LegalSection>
      <LegalSection title="10. Children">
        Testum is intended for NEET aspirants. If you are under 18, please use the platform with the consent
        and supervision of a parent or guardian.
      </LegalSection>
      <LegalSection title="11. Contact us">
        Telegram: <a href={SUPPORT.telegram} target="_blank" rel="noopener noreferrer">{SUPPORT.telegramHandle}</a> ·
        Email: <a href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>
      </LegalSection>
    </LegalPage>
  );
}
