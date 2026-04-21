/**
 * Утилита для позиционирования подменю в контекстном меню
 */
export function calculateSubmenuPosition(
  menuRect: DOMRect,
  buttonRect: DOMRect,
  subMenuRect: DOMRect,
  parentRect: DOMRect
): { left: number; top: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Вычисляем позицию кнопки относительно родительского div
  const buttonTopRelativeToParent = buttonRect.top - parentRect.top;

  // Уменьшаем отступ для более плотного прилегания
  let left = menuRect.width + 2;
  let top = buttonTopRelativeToParent;

  // Проверяем, помещается ли справа
  if (menuRect.right + subMenuRect.width + 2 > viewportWidth - 10) {
    // Показываем слева от контекстного меню
    left = -subMenuRect.width - 2;
    // Не допускаем выход за левый край viewport
    const subMenuLeftEdge = parentRect.left + left;
    if (subMenuLeftEdge < 10) {
      left = 10 - parentRect.left;
    }
  }

  // Проверяем вертикальное позиционирование
  const subMenuBottom = parentRect.top + top + subMenuRect.height;
  if (subMenuBottom > viewportHeight - 10) {
    // Сдвигаем вверх, чтобы поместилось, но не выше верха кнопки
    const overflow = subMenuBottom - (viewportHeight - 10);
    top = Math.max(buttonTopRelativeToParent, buttonTopRelativeToParent - overflow);
  }

  // Проверяем, не выходит ли верхняя часть за границу
  if (parentRect.top + top < 10) {
    top = 10 - parentRect.top;
  }

  return { left, top };
}
