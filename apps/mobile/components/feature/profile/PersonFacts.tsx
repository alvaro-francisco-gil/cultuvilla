import { Text, VStack } from '../../primitives';

export interface PersonFact {
  label: string;
  value: string;
}

/**
 * The facts column beside a person's photo: a muted label with its value
 * underneath, one pair per known fact. Stacked rather than label-and-value on
 * one line because this column is barely half the screen wide — a long list of
 * oficios or a long village name gets the full width this way instead of
 * wrapping against a label.
 *
 * Facts with nothing to say are dropped by the caller; a column of empty
 * labels reads as broken data rather than as a person who hasn't filled
 * anything in.
 */
export function PersonFacts({ facts }: { facts: PersonFact[] }) {
  if (facts.length === 0) return null;

  return (
    <VStack gap={3} className="flex-1">
      {facts.map((fact) => (
        <VStack key={fact.label} gap={0}>
          <Text variant="caption" tone="muted">
            {fact.label}
          </Text>
          <Text>{fact.value}</Text>
        </VStack>
      ))}
    </VStack>
  );
}
