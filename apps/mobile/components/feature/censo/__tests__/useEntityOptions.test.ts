import { renderHook, waitFor } from '@testing-library/react-native';
import { getBarrios, getPlaces } from '@cultuvilla/shared/services/municipalityService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { getFestivalPosters } from '@cultuvilla/shared/services/festivalPosterService';
import { getNewsPostsByMunicipality } from '@cultuvilla/shared/services/newsService';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import { buildNewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import { useEntityOptions } from '../useEntityOptions';

jest.mock('@cultuvilla/shared/services/municipalityService');
jest.mock('@cultuvilla/shared/services/organizationService');
jest.mock('@cultuvilla/shared/services/eventService');
jest.mock('@cultuvilla/shared/services/festivalPosterService');
jest.mock('@cultuvilla/shared/services/newsService');
jest.mock('@cultuvilla/shared/services/imageService');

const mockGetBarrios = jest.mocked(getBarrios);
const mockGetPlaces = jest.mocked(getPlaces);
const mockGetOrganizations = jest.mocked(getOrganizationsByMunicipality);
const mockGetEvents = jest.mocked(getEventsByMunicipality);
const mockGetPosters = jest.mocked(getFestivalPosters);
const mockGetNews = jest.mocked(getNewsPostsByMunicipality);
const mockNewsImageDownloadURL = jest.mocked(newsImageDownloadURL);

beforeEach(() => {
  mockGetBarrios.mockResolvedValue([]);
  mockGetPlaces.mockResolvedValue([]);
  mockGetOrganizations.mockResolvedValue([]);
  mockGetEvents.mockResolvedValue([]);
  mockGetPosters.mockResolvedValue([]);
  mockGetNews.mockResolvedValue([]);
});

it('adds entity thumbnails to dynamically resolved censo options', async () => {
  mockGetPlaces.mockResolvedValue([
    { id: 'place-1', name: 'Plaza Mayor', images: ['https://img/plaza.jpg'] },
  ] as Awaited<ReturnType<typeof getPlaces>>);
  mockGetNews.mockResolvedValue([
    {
      ...buildNewsPostData({
        municipalityId: 'village-1',
        createdBy: 'user-1',
        organizerUserIds: ['user-1'],
        title: 'Las fiestas',
        body: '',
        category: 'otro',
        coverImage: { storagePath: 'news/cover.jpg', width: 800, height: 600 },
        createdAt: new Date('2026-07-18T10:00:00Z'),
        updatedAt: new Date('2026-07-18T10:00:00Z'),
      }),
      id: 'news-1',
    },
  ]);
  mockNewsImageDownloadURL.mockResolvedValue('https://img/news.jpg');

  const { result } = renderHook(() => useEntityOptions('village-1', [
    { source: 'custom', key: 'place', label: 'Lugar', type: 'select', optionsSource: 'places', required: false },
    { source: 'custom', key: 'news', label: 'Artículo', type: 'select', optionsSource: 'news', required: false },
  ]));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.optionsByField.place).toEqual([
    { value: 'place-1', label: 'Plaza Mayor', imageUri: 'https://img/plaza.jpg' },
  ]);
  expect(result.current.optionsByField.news).toEqual([
    { value: 'news-1', label: 'Las fiestas', imageUri: 'https://img/news.jpg' },
  ]);
});
