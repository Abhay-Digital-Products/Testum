import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { SUPPORT } from "@/lib/support";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy  -  Testum NEET CBT Test Series" },
      { name: "description", content: "Testum's refund policy for digital test-series purchases, failed payments and duplicate transactions." },
      { property: "og:title", content: "Refund Policy  -  Testum" },
      { property: "og:description", content: "How refunds, failed payments and duplicate charges are handled on Testum." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Refund,
});

function Refund() {
  return (
    <LegalPage title="Refund Policy" updated="8 August 2026">
      <LegalSection title="1. Digital product">
        Testum plans are digital products that unlock instantly after payment. Because access to the full test
        content is granted immediately, purchases are non-refundable once the plan is activated.
      </LegalSection>
      <LegalSection title="2. Failed or pending payments">
        If money was deducted but your plan did not unlock, do not pay again. Send us the payment reference and
        the registered email  -  we will either activate your plan or the amount will be auto-reversed by your
        bank, typically within 5 - 7 working days.
      </LegalSection>
      <LegalSection title="3. Duplicate payments">
        If you were charged twice for the same plan, the duplicate amount is refunded in full to the original
        payment method after verification.
      </LegalSection>
      <LegalSection title="4. Technical issues">
        If a platform-side fault prevents you from accessing the tests you paid for and we are unable to fix it,
        we will restore access or issue a fair refund at our discretion.
      </LegalSection>
      <LegalSection title="5. How to raise a request">
        Contact us within 7 days of the transaction with your registered email, plan name, date and payment
        reference. Approved refunds are processed to the original payment method within 5 - 7 working days after
        approval.
      </LegalSection>
      <LegalSection title="6. Contact">
        WhatsApp: <a href={SUPPORT.whatsapp} target="_blank" rel="noopener noreferrer">chat with support</a> ·
        Telegram: <a href={SUPPORT.telegram} target="_blank" rel="noopener noreferrer">{SUPPORT.telegramHandle}</a> ·
        Email: <a href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>
      </LegalSection>
    </LegalPage>
  );
}
