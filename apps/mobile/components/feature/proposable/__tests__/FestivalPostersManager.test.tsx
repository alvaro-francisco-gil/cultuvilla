import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FestivalPostersManager } from '../FestivalPostersManager';
import {
  getFestivalPosters, createFestivalPoster, proposeFestivalPoster, approveFestivalPoster,
  newFestivalPosterId,
} from '@cultuvilla/shared/services/festivalPosterService';
import { uploadFestivalPosterImage } from '@cultuvilla/shared/services/imageService';
import { pickImageAsBlob } from '../../../../lib/images';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';

jest.mock('@cultuvilla/shared/services/festivalPosterService', () => ({
  newFestivalPosterId: jest.fn().mockReturnValue('new-id'),
  getFestivalPosters: jest.fn(),
  createFestivalPoster: jest.fn().mockResolvedValue('new-id'),
  proposeFestivalPoster: jest.fn().mockResolvedValue('new-id'),
  approveFestivalPoster: jest.fn().mockResolvedValue(undefined),
  rejectFestivalPoster: jest.fn().mockResolvedValue(undefined),
  updateFestivalPoster: jest.fn().mockResolvedValue(undefined),
  deleteFestivalPoster: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadFestivalPosterImage: jest.fn().mockResolvedValue('https://example.com/poster.jpg'),
}));
jest.mock('../../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockGet = getFestivalPosters as jest.Mock;
const mockPick = pickImageAsBlob as jest.Mock;

const stubImage = { blob: {} as Blob, filename: 'poster.jpg', contentType: 'image/jpeg', previewUri: 'file://poster.jpg' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([]);
  mockPick.mockResolvedValue(stubImage);
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: 'alice', loading: false });
});

describe('<FestivalPostersManager>', () => {
  it('a villager submitting the form proposes a pending poster (year precision)', async () => {
    const { getByTestId, getByLabelText } = render(<FestivalPostersManager villageId="m1" />);
    fireEvent.press(getByLabelText('village.festivalPosters.form.image'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    fireEvent.changeText(getByTestId('poster-year-input'), '2026');
    fireEvent.press(getByTestId('poster-submit'));

    await waitFor(() =>
      expect(proposeFestivalPoster).toHaveBeenCalledWith(
        expect.objectContaining({
          municipalityId: 'm1',
          year: 2026,
          datePrecision: 'year',
          startsAt: null,
          endsAt: null,
          proposedBy: 'alice',
          imageURL: 'https://example.com/poster.jpg',
        }),
        'new-id',
      ),
    );
    expect(createFestivalPoster).not.toHaveBeenCalled();
    expect(uploadFestivalPosterImage).toHaveBeenCalledWith('m1', 'new-id', stubImage);
  });

  it('an organizer submitting the form creates the poster directly', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId, getByLabelText } = render(<FestivalPostersManager villageId="m1" />);
    fireEvent.press(getByLabelText('village.festivalPosters.form.image'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    fireEvent.changeText(getByTestId('poster-year-input'), '2027');
    fireEvent.press(getByTestId('poster-submit'));

    await waitFor(() =>
      expect(createFestivalPoster).toHaveBeenCalledWith(
        expect.objectContaining({ municipalityId: 'm1', year: 2027, datePrecision: 'year' }),
        'new-id',
      ),
    );
    expect(proposeFestivalPoster).not.toHaveBeenCalled();
  });

  it('an organizer can approve a pending row', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    mockGet.mockResolvedValue([
      {
        id: 'p1', municipalityId: 'm1', year: 2025, title: 'San Roque', imageURL: null,
        datePrecision: 'year', startsAt: null, endsAt: null, createdAt: new Date(),
        status: 'pending', proposedBy: 'alice', reviewedBy: null, reviewedAt: null,
      },
    ]);
    const { findByTestId } = render(<FestivalPostersManager villageId="m1" mode="manage" />);
    fireEvent.press(await findByTestId('action-approve'));
    await waitFor(() => expect(approveFestivalPoster).toHaveBeenCalledWith('p1', 'boss'));
  });
});
