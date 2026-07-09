'use client';

import { useState, type KeyboardEvent } from 'react';
import { PROFILE_MAX_SKILLS } from '@cnsofts/shared';
import { Icon } from '@/components/ui';
import styles from './skills-field.module.css';

export interface SkillsFieldProps {
  values: string[];
  onChange: (skills: string[]) => void;
}

/** Free-form tag input: type a skill and press Enter or comma to add it;
 *  Backspace on an empty box removes the last; the × removes a specific one. */
export function SkillsField({ values, onChange }: SkillsFieldProps) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const skill = raw.trim();
    if (!skill || values.length >= PROFILE_MAX_SKILLS) return;
    // Case-insensitive de-dupe, mirroring the backend.
    if (values.some((v) => v.toLowerCase() === skill.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, skill]);
    setDraft('');
  }

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      remove(values.length - 1);
    }
  }

  return (
    <div className={styles.field}>
      {values.map((skill, i) => (
        <span key={`${skill}-${i}`} className={styles.chip}>
          {skill}
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove ${skill}`}
            onClick={() => remove(i)}
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <input
        className={styles.input}
        value={draft}
        placeholder={values.length ? 'Add another…' : 'e.g. React, Node.js…'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
