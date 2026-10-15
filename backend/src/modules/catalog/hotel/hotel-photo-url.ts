/**
 * Публичный URL единого фото отеля (единый каталог фотографий).
 *
 * Файл на диске ОДИН на физическую гостиницу — `hotel_<hotelId>.webp` — и его
 * используют тур с этим отелем, карточка в услуге «Отели», поиск и PDP.
 *
 * `?v=` — версия файла (момент последней загрузки). Диск-имя не меняется, но
 * при замене главного фото ссылка становится другой, поэтому браузер и CDN не
 * отдают старое изображение из кэша, а все карточки/офферы автоматически
 * подхватывают новое — без копий файла на тур/поставщика.
 */
export function hotelPhotoUrl(photoFile: string, photoUpdatedAt: Date | null | undefined): string {
  const version = photoUpdatedAt ? photoUpdatedAt.getTime().toString(36) : "";
  return version ? `/hotels/${photoFile}?v=${version}` : `/hotels/${photoFile}`;
}
