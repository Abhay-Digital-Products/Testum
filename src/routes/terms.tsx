import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { SUPPORT } from "@/lib/support";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions  -  Testum NEET CBT Test Series" },
      {
        name: "description",
        content:
          "The terms that govern your use of the Testum NEET CBT test-series platform, accounts, plans and content.",
      },
      { property: "og:title", content: "Terms & Conditions  -  Testum" },
      {
        property: "og:description",
        content: "Rules for using Testum accounts, plans, tests and content.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms & Conditions" updated="8 August 2026">
      <LegalSection title="1. Acceptance">
        By creating an account or purchasing a plan on Testum, you agree to these terms. If you do
        not agree, please do not use the platform.
      </LegalSection>
      <LegalSection title="2. Your account">
        You must provide accurate details at sign-up and keep your password secure. One account is
        for one student only. Sharing credentials, reselling access or attempting tests on behalf of
        another person may result in suspension without refund.
      </LegalSection>
      <LegalSection title="3. Plans and access">
        <ul>
          <li>
            <b>Chapter-wise plan</b> unlocks chapter-wise test series only.
          </li>
          <li>
            <b>Part syllabus plan</b> unlocks part-syllabus test series only.
          </li>
          <li>
            <b>Full syllabus plan</b> unlocks full-syllabus test series only.
          </li>
          <li>
            <b>Combo pack</b> unlocks every test series on the platform.
          </li>
        </ul>
        Access begins immediately after a successful payment and remains valid for the duration
        shown on the plan at the time of purchase.
      </LegalSection>
      <LegalSection title="4. Content and intellectual property">
        All questions, solutions, images, reports and platform design are owned by Testum or its
        licensors. You may use them for your own preparation only. Copying, redistributing,
        screen-recording for distribution, or publishing our content anywhere is not permitted.
      </LegalSection>
      <LegalSection title="5. Fair use during tests">
        Tests are timed and auto-submitted when the timer ends. Using unfair means, automation, or
        multiple devices to manipulate scores is prohibited. We may invalidate affected attempts.
      </LegalSection>
      <LegalSection title="6. Availability">
        We aim for uninterrupted service but cannot guarantee it. Tests, schedules and question
        counts may be updated or corrected. Attempts are auto-saved so that a disconnection does not
        lose your progress.
      </LegalSection>
      <LegalSection title="7. No outcome guarantee">
        Testum is a practice and analysis platform. We make no promise of any particular NEET score,
        rank or admission outcome.
      </LegalSection>
      <LegalSection title="8. Limitation of liability">
        To the extent permitted by law, our total liability for any claim relating to the platform
        is limited to the amount you paid for the plan in question.
      </LegalSection>
      <LegalSection title="9. Changes">
        We may update these terms. Continued use after an update means you accept the revised terms.
      </LegalSection>
      <LegalSection title="10. Contact">
        Telegram:{" "}
        <a href={SUPPORT.telegram} target="_blank" rel="noopener noreferrer">
          {SUPPORT.telegramHandle}
        </a>{" "}
        · Email: <a href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>
      </LegalSection>
    </LegalPage>
  );
}
