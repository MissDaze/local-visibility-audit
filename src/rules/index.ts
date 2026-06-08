import { Rule } from '../types';
import { visibilityRules } from './visibility.rules';
import { trustRules } from './trust.rules';
import { competitiveRules } from './competitive.rules';
import { websiteRules } from './website.rules';
import { gbpRules } from './gbp.rules';
import { localRules } from './local.rules';
import { citationRules } from './citation.rules';
import { technicalRules } from './technical.rules';
import { measurementRules } from './measurement.rules';

export const ALL_RULES: Rule[] = [
  ...visibilityRules,
  ...trustRules,
  ...competitiveRules,
  ...websiteRules,
  ...gbpRules,
  ...localRules,
  ...citationRules,
  ...technicalRules,
  ...measurementRules,
];

export {
  visibilityRules,
  trustRules,
  competitiveRules,
  websiteRules,
  gbpRules,
  localRules,
  citationRules,
  technicalRules,
  measurementRules,
};
