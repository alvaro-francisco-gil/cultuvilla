import { VStack, HStack, Text, Button, Input, Pressable, Avatar } from '../../primitives';
import { pickImageAsBlob } from '../../../lib/images';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

export interface ProposableTypeOption {
  value: string;
  label: string;
}

export interface ProposableFormProps {
  /** "Añadir X" header shown at the top of the form. */
  title: string;
  /** Currently-picked image, or null. Its `previewUri` renders the thumbnail.
   * Leave `onImageChange` unset to hide the image picker entirely (e.g.
   * agrupaciones, which have no client image-upload path). */
  image?: UploadableImage | null;
  onImageChange?: (image: UploadableImage) => void;
  imageLabels?: { add: string; selected: string };

  name: string;
  onChangeName: (value: string) => void;
  namePlaceholder: string;
  nameTestID?: string;

  /** Omit description entirely (e.g. barrios) by leaving onChangeDescription unset. */
  description?: string;
  onChangeDescription?: (value: string) => void;
  descriptionPlaceholder?: string;

  /** Chip type-picker. Omit (leave options unset) for entities without a type. */
  typeLabel?: string;
  typeOptions?: ProposableTypeOption[];
  typeValue?: string;
  onChangeType?: (value: string) => void;

  submitLabel: string;
  submitTestID?: string;
  onSubmit: () => void;
  saving: boolean;
  disabled: boolean;
}

/**
 * Standardized "Añadir X" form shared by the Lugares, Barrios and Agrupaciones
 * proposable surfaces. Layout, top-to-bottom: title → prominent image picker
 * (first, so the photo leads) → name → optional description → optional type
 * chips → submit. The selected type chip uses a light-orange fill.
 *
 * The form owns image picking (via pickImageAsBlob) so the three managers no
 * longer duplicate that logic; it hands the picked image back through
 * onImageChange. Selection-chip and field styling live here only.
 */
export function ProposableForm({
  title,
  image,
  onImageChange,
  imageLabels,
  name,
  onChangeName,
  namePlaceholder,
  nameTestID,
  description,
  onChangeDescription,
  descriptionPlaceholder,
  typeLabel,
  typeOptions,
  typeValue,
  onChangeType,
  submitLabel,
  submitTestID,
  onSubmit,
  saving,
  disabled,
}: ProposableFormProps) {
  const showImage = onImageChange !== undefined;
  const showDescription = onChangeDescription !== undefined;
  const showTypes = !!typeOptions && typeOptions.length > 0 && onChangeType !== undefined;

  return (
    <VStack gap={3}>
      <Text variant="h3">{title}</Text>

      {showImage ? (
        <VStack gap={1} align="center">
          <Pressable
            onPress={async () => {
              const picked = await pickImageAsBlob();
              if (picked) onImageChange!(picked);
            }}
            accessibilityLabel={image ? imageLabels?.selected : imageLabels?.add}
          >
            <Avatar size={72} uri={image?.previewUri ?? null} initials="+" />
          </Pressable>
          <Text tone="muted" variant="bodySm">
            {image ? imageLabels?.selected : imageLabels?.add}
          </Text>
        </VStack>
      ) : null}

      <Input
        testID={nameTestID}
        value={name}
        onChangeText={onChangeName}
        placeholder={namePlaceholder}
      />

      {showDescription ? (
        <Input
          value={description ?? ''}
          onChangeText={onChangeDescription}
          placeholder={descriptionPlaceholder}
          multiline
        />
      ) : null}

      {showTypes ? (
        <VStack gap={1}>
          {typeLabel ? <Text className="text-muted text-sm">{typeLabel}</Text> : null}
          <HStack gap={2} className="flex-wrap">
            {typeOptions!.map((opt) => {
              const selected = opt.value === typeValue;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onChangeType!(opt.value)}
                  className={`px-3 py-1 rounded-full border ${
                    selected ? 'bg-[#f3a64b] border-[#f3a64b]' : 'border-subtle'
                  }`}
                >
                  <Text className={selected ? 'text-primary' : undefined}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </HStack>
        </VStack>
      ) : null}

      <Button testID={submitTestID} onPress={onSubmit} loading={saving} disabled={disabled}>
        {submitLabel}
      </Button>
    </VStack>
  );
}
