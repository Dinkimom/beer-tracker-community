'use client';

import { useEffect, useMemo, useState } from 'react';
import Snowfall from 'react-snowfall';

import { ZIndex } from '@/constants';
import { useChristmasThemeStorage, useThemeStorage } from '@/hooks/useLocalStorage';

// Проверка, попадает ли текущая дата в период показа снега (15 декабря - 15 января)
const isInChristmasPeriod = (): boolean => {
  const now = new Date();
  const month = now.getMonth(); // 0 = январь, 11 = декабрь
  const day = now.getDate();

  // С 15 декабря по 31 декабря
  if (month === 11 && day >= 15) {
    return true;
  }
  // С 1 января по 15 января
  if (month === 0 && day <= 15) {
    return true;
  }

  return false;
};

// Функция для рисования формы снежинки (используется повторно)
function drawSnowflakeShape(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number): void {
  // Рисуем центральный крест
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.stroke();

  // Рисуем диагональные линии
  const diagonalRadius = radius * 0.7;
  ctx.beginPath();
  ctx.moveTo(centerX - diagonalRadius * 0.7, centerY - diagonalRadius * 0.7);
  ctx.lineTo(centerX + diagonalRadius * 0.7, centerY + diagonalRadius * 0.7);
  ctx.moveTo(centerX + diagonalRadius * 0.7, centerY - diagonalRadius * 0.7);
  ctx.lineTo(centerX - diagonalRadius * 0.7, centerY + diagonalRadius * 0.7);
  ctx.stroke();

  // Рисуем маленькие веточки на концах
  const branchLength = radius * 0.3;
  const positions = [
    { x: 0, y: -radius }, // верх
    { x: 0, y: radius }, // низ
    { x: -radius, y: 0 }, // лево
    { x: radius, y: 0 }, // право
  ];

  positions.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.moveTo(centerX + x, centerY + y);
    ctx.lineTo(centerX + x - branchLength * 0.5, centerY + y - branchLength * 0.5);
    ctx.moveTo(centerX + x, centerY + y);
    ctx.lineTo(centerX + x + branchLength * 0.5, centerY + y - branchLength * 0.5);
    ctx.stroke();
  });
}

// Функция для создания canvas с изображением снежинки
function createSnowflakeCanvas(size: number, theme: 'dark' | 'light'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  // Очищаем canvas
  ctx.clearRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 3;

  // В светлой теме рисуем сначала темную обводку для контраста
  if (theme === 'light') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    // Рисуем темную обводку
    drawSnowflakeShape(ctx, centerX, centerY, radius);

    // Затем рисуем белую снежинку поверх
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
  } else {
    // В темной теме просто белая снежинка
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
  }

  // Рисуем снежинку поверх (или просто если темная тема)
  drawSnowflakeShape(ctx, centerX, centerY, radius);

  return canvas;
}

export function Snow() {
  const [theme] = useThemeStorage();
  const [christmasThemeEnabled] = useChristmasThemeStorage();
  const [isMounted, setIsMounted] = useState(false);

  // Отслеживаем монтирование компонента для предотвращения hydration mismatch
  useEffect(() => {
    // Нам нужно установить флаг монтирования, чтобы избежать ошибок гидратации.
    // Это осознанное использование setState внутри эффекта.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Создаем canvas элементы с изображениями снежинок разных размеров
  const snowflakeImages = useMemo(() => {
    if (typeof window === 'undefined' || !isMounted) return [];

    return [
      createSnowflakeCanvas(12, theme),
      createSnowflakeCanvas(16, theme),
      createSnowflakeCanvas(20, theme),
      createSnowflakeCanvas(24, theme),
    ];
  }, [theme, isMounted]);

  // Не рендерим на сервере или до завершения гидратации
  if (!isMounted) return null;

  // Отключаем снег вне праздничного периода или если новогодняя тема отключена
  if (!isInChristmasPeriod() || !christmasThemeEnabled) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none ${ZIndex.class('overlay')} overflow-hidden`}>
      <Snowfall
        changeFrequency={100}
        images={snowflakeImages}
        radius={[6, 12]}
        snowflakeCount={50}
        speed={[0.5, 1.5]}
        style={{
          height: '100%',
          position: 'fixed',
          width: '100%',
        }}
        wind={[-0.5, 0.5]}
      />
    </div>
  );
}

