import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, LegalSection } from '@/features/legal/legal-doc';
import { LEGAL } from '@/features/legal/legal.config';

export const metadata: Metadata = {
  title: `Terms of Service · ${LEGAL.productName}`,
  description: `The terms that govern your use of ${LEGAL.productName}.`,
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={LEGAL.effectiveDate}
      intro={`These terms govern your access to and use of ${LEGAL.productName}. By creating an account or using the service, you agree to them.`}
    >
      <LegalSection heading="1. Acceptance of these terms">
        <p>
          By accessing or using {LEGAL.productName} (the “Service”), operated by{' '}
          {LEGAL.legalEntity}, you agree to be bound by these Terms of Service.
          If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="2. The Service">
        <p>
          {LEGAL.productName} is a project-tracking application providing kanban
          boards, a delivery roadmap, documentation pages, discussion channels
          and an API for connecting coding agents. We may add, change or remove
          features over time.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your account">
        <ul>
          <li>
            You must provide accurate information and keep your credentials
            secure. You are responsible for all activity under your account.
          </li>
          <li>
            A new account has no project access until you are invited to a
            project or you create one. Project roles determine what each member
            can see and do.
          </li>
          <li>
            Notify us promptly at{' '}
            <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> if
            you suspect unauthorized use of your account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>
            Use the Service unlawfully, or to store or share unlawful, harmful
            or infringing content.
          </li>
          <li>
            Attempt to access accounts, data or systems you are not authorized
            to access, or disrupt or probe the Service’s security.
          </li>
          <li>
            Abuse, overload or interfere with the Service, or circumvent its
            limits, rate limits or access controls.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Your content">
        <p>
          You retain ownership of the content you create in {LEGAL.productName}.
          You grant us the limited license needed to host, store, process and
          display that content solely to operate and provide the Service to you
          and the collaborators you invite. You are responsible for the content
          you upload and for having the rights to it.
        </p>
      </LegalSection>

      <LegalSection heading="6. Coding agents and tokens">
        <p>
          You may generate personal access tokens so a coding agent can use the
          API. A token acts <strong>as you</strong>, within the scope and
          permissions you grant it. You are responsible for actions taken with
          tokens you issue, and you can revoke them at any time.
        </p>
      </LegalSection>

      <LegalSection heading="7. Availability and changes">
        <p>
          We aim to keep the Service available and reliable, but we provide it
          “as is” and may modify, suspend or discontinue any part of it. We are
          not liable for interruptions, data loss or delays. Keep your own
          backups of anything critical.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers and limitation of liability">
        <p>
          To the fullest extent permitted by law, the Service is provided
          without warranties of any kind, and {LEGAL.legalEntity} is not liable
          for any indirect, incidental or consequential damages, or for loss of
          data, profits or goodwill arising from your use of the Service.
        </p>
      </LegalSection>

      <LegalSection heading="9. Termination">
        <p>
          You may stop using the Service and request account deletion at any
          time. We may suspend or terminate access if you violate these terms or
          use the Service in a way that risks harm to others or to the Service.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing law">
        <p>
          These terms are governed by the laws of {LEGAL.governingLaw}, without
          regard to conflict-of-laws principles. Disputes will be subject to the
          courts having jurisdiction there.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these terms">
        <p>
          We may update these terms from time to time. When we make material
          changes we will update the “Last updated” date above and, where
          appropriate, notify you in the app. Continued use after changes take
          effect means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact us">
        <p>
          Questions about these terms? Email{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. See
          also our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
