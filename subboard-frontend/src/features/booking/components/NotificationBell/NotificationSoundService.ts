// NotificationSoundService.ts - Сервис для воспроизведения звуков уведомлений

export type NotificationPriority = 'urgent' | 'high' | 'medium' | 'low';

class NotificationSoundService {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.7;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext не поддерживается:', error);
    }
  }

  // Создание уникального звука для SUPBoard
  private createSUPBoardSound(priority: NotificationPriority): void {
    if (!this.audioContext || !this.isEnabled) return;

    const now = this.audioContext.currentTime;
    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Подключение узлов
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Настройка звука в зависимости от приоритета
    switch (priority) {
      case 'urgent':
        // Тревожный звук: быстрые высокие ноты
        this.playUrgentSound(oscillator1, oscillator2, gainNode, now);
        break;
      case 'high':
        // Внимание: двойной тон
        this.playHighSound(oscillator1, oscillator2, gainNode, now);
        break;
      case 'medium':
        // Приятный SUPBoard звук: мелодичный тон
        this.playMediumSound(oscillator1, oscillator2, gainNode, now);
        break;
      case 'low':
        // Тихий деликатный звук
        this.playLowSound(oscillator1, oscillator2, gainNode, now);
        break;
    }
  }

  private playUrgentSound(osc1: OscillatorNode, osc2: OscillatorNode, gain: GainNode, startTime: number) {
    // Тревожный звук: быстрая последовательность высоких тонов
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.8, startTime + 0.01);
    
    // Первый тон - высокий
    osc1.frequency.setValueAtTime(800, startTime);
    osc1.frequency.exponentialRampToValueAtTime(1200, startTime + 0.1);
    
    // Второй тон - гармоника
    osc2.frequency.setValueAtTime(1600, startTime);
    osc2.frequency.exponentialRampToValueAtTime(2400, startTime + 0.1);
    
    osc1.type = 'triangle';
    osc2.type = 'sine';
    
    // Быстрое затухание
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
    
    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + 0.2);
    osc2.stop(startTime + 0.2);

    // Повторяем звук через короткий интервал
    setTimeout(() => {
      if (this.audioContext) {
        this.createSingleTone(900, 0.1, 'triangle');
      }
    }, 200);
  }

  private playHighSound(osc1: OscillatorNode, osc2: OscillatorNode, gain: GainNode, startTime: number) {
    // Двойной приятный тон
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.6, startTime + 0.02);
    
    // Первый тон
    osc1.frequency.setValueAtTime(600, startTime);
    osc1.frequency.exponentialRampToValueAtTime(800, startTime + 0.15);
    
    // Второй тон - октава
    osc2.frequency.setValueAtTime(1200, startTime);
    osc2.frequency.exponentialRampToValueAtTime(1600, startTime + 0.15);
    
    osc1.type = 'sine';
    osc2.type = 'triangle';
    
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
    
    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + 0.25);
    osc2.stop(startTime + 0.25);
  }

  private playMediumSound(osc1: OscillatorNode, osc2: OscillatorNode, gain: GainNode, startTime: number) {
    // Фирменный звук SUPBoard: мелодичный и приятный
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.5, startTime + 0.03);
    
    // Основной тон - теплый и приятный
    osc1.frequency.setValueAtTime(440, startTime); // Нота A
    osc1.frequency.exponentialRampToValueAtTime(660, startTime + 0.2); // Нота E
    
    // Гармоника
    osc2.frequency.setValueAtTime(880, startTime); // Октава A
    osc2.frequency.exponentialRampToValueAtTime(1320, startTime + 0.2); // Октава E
    
    osc1.type = 'sine';
    osc2.type = 'triangle';
    
    // Плавное затухание
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
    
    osc1.start(startTime);
    osc2.start(startTime + 0.05); // Небольшая задержка для эффекта
    osc1.stop(startTime + 0.35);
    osc2.stop(startTime + 0.4);
  }

  private playLowSound(osc1: OscillatorNode, osc2: OscillatorNode, gain: GainNode, startTime: number) {
    // Деликатный тихий звук
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.3, startTime + 0.05);
    
    osc1.frequency.setValueAtTime(300, startTime);
    osc1.frequency.exponentialRampToValueAtTime(400, startTime + 0.25);
    
    osc2.frequency.setValueAtTime(600, startTime);
    osc2.frequency.exponentialRampToValueAtTime(800, startTime + 0.25);
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
    
    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + 0.35);
    osc2.stop(startTime + 0.35);
  }

  private createSingleTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration + 0.1);
  }

  // Публичные методы
  public playNotificationSound(priority: NotificationPriority = 'medium'): void {
    // Проверяем, можем ли воспроизводить звук
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().then(() => {
        this.createSUPBoardSound(priority);
      });
    } else {
      this.createSUPBoardSound(priority);
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public isAudioEnabled(): boolean {
    return this.isEnabled && !!this.audioContext;
  }

  // Тестовые звуки для настройки
  public testSound(priority: NotificationPriority): void {
    console.log(`🔊 Тестируем звук приоритета: ${priority}`);
    this.playNotificationSound(priority);
  }

  // Фирменный звук SUPBoard для особых событий
  public playBrandSound(): void {
    if (!this.audioContext || !this.isEnabled) return;

    // Играем мелодичную последовательность нот
    const notes = [440, 554, 659, 880]; // A, C#, E, A (арпеджио A major)
    notes.forEach((note, index) => {
      setTimeout(() => {
        this.createSingleTone(note, 0.3, 'sine');
      }, index * 150);
    });
  }
}

// Экспортируем синглтон
export const notificationSoundService = new NotificationSoundService();

// Хук для использования в React компонентах
export const useNotificationSound = () => {
  const playSound = (priority: NotificationPriority = 'medium') => {
    notificationSoundService.playNotificationSound(priority);
  };

  const setVolume = (volume: number) => {
    notificationSoundService.setVolume(volume);
  };

  const setEnabled = (enabled: boolean) => {
    notificationSoundService.setEnabled(enabled);
  };

  const testSound = (priority: NotificationPriority) => {
    notificationSoundService.testSound(priority);
  };

  const playBrandSound = () => {
    notificationSoundService.playBrandSound();
  };

  return {
    playSound,
    setVolume,
    setEnabled,
    testSound,
    playBrandSound,
    isEnabled: notificationSoundService.isAudioEnabled()
  };
}; 