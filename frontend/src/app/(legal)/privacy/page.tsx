import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc, LegalSection } from '@/features/legal/legal-doc';
import { LEGAL } from '@/features/legal/legal.config';

export const metadata: Metadata = {
  title: `Privacy Policy · ${LEGAL.productName}`,
  description: `How ${LEGAL.productName} collects, uses and protects your data.`,
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={LEGAL.effectiveDate}
      intro={`This policy explains what information ${LEGAL.productName} collects, why, and the choices you have. We keep data collection to what the product actually needs to work.`}
    >
      <LegalSection heading="1. Who we are">
        <p>
          {LEGAL.productName} (“we”, “us”) provides a project-tracking
          application — kanban boards, a delivery roadmap, documentation pages
          and discussion channels — operated by {LEGAL.legalEntity}. This policy
          covers the {LEGAL.productName} web application and its API.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>We collect only what you give us and what the service needs to run:</p>
        <ul>
          <li>
            <strong>Account details</strong> — your name and email address, and
            a password which we store only as a salted one-way hash (we never
            store your plaintext password).
          </li>
          <li>
            <strong>Profile information</strong> you choose to add — title, bio,
            skills, location, timezone and any profile links, plus a selected
            avatar preference.
          </li>
          <li>
            <strong>Content you create</strong> — projects, features, tasks,
            subtasks, milestones, documentation pages, channel messages, task
            comments and any images you upload.
          </li>
          <li>
            <strong>Access tokens</strong> — if you connect a coding agent, we
            store the metadata of the personal access tokens you generate (name,
            scope, project scope, expiry) and a hash of the token itself.
          </li>
          <li>
            <strong>Notifications and activity</strong> needed to show you what
            changed in your projects.
          </li>
          <li>
            <strong>Minimal technical data</strong> — your session token and
            avatar preference are stored in your browser. Server logs may record
            standard request metadata (such as IP address and timestamp) for
            security and reliability. We do not use third-party advertising or
            analytics trackers.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use your information">
        <ul>
          <li>To provide, operate and secure the service and your account.</li>
          <li>To authenticate you and authorize what you can access.</li>
          <li>
            To deliver in-app notifications about activity in your projects.
          </li>
          <li>
            To let coding agents you connect act on your behalf, strictly within
            the scope of the token you issue.
          </li>
          <li>
            To diagnose problems, prevent abuse and comply with legal
            obligations.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. How your data is stored and protected">
        <p>
          Account and project data is stored in a managed database; uploaded
          images are stored in object storage and served over unguessable URLs.
          Passwords are hashed, access tokens are hashed and treated as
          credentials, and traffic is served over encrypted connections. No
          system is perfectly secure, but we take reasonable measures to protect
          your information.
        </p>
      </LegalSection>

      <LegalSection heading="5. When we share information">
        <p>We do not sell your personal data. We share it only:</p>
        <ul>
          <li>
            <strong>Within your projects</strong> — content is visible to the
            members and clients you (or a project admin) invite, according to
            their role.
          </li>
          <li>
            <strong>With service providers</strong> that host our
            infrastructure, object storage and network delivery, solely to
            operate the service.
          </li>
          <li>
            <strong>For legal reasons</strong> — when required by law, or to
            protect the rights, safety and security of our users and the
            service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Coding agents and the API">
        <p>
          When you generate a personal access token, any coding agent using it
          acts <strong>as you</strong>, with exactly the permissions and project
          scope you grant. You are responsible for tokens you issue; you can
          rename, restrict or revoke them at any time from the app.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data retention and deletion">
        <p>
          We keep your information for as long as your account is active or as
          needed to provide the service. You can delete content you create, and
          you may request deletion of your account and associated personal data
          by contacting us at{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
          Some records may be retained where required for legal or security
          purposes.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights">
        <p>
          Depending on where you live, you may have the right to access,
          correct, export or delete your personal data, and to object to or
          restrict certain processing. To exercise these rights, contact us at{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection heading="9. Children">
        <p>
          {LEGAL.productName} is not directed to children and is intended for
          use by people who can form a binding contract. We do not knowingly
          collect personal data from children.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to this policy">
        <p>
          We may update this policy from time to time. When we make material
          changes we will update the “Last updated” date above and, where
          appropriate, notify you in the app.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <p>
          Questions about this policy or your data? Email us at{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. See
          also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
