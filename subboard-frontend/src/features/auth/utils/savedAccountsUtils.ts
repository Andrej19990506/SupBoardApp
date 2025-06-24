export interface SavedAccount {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  lastLogin: string;
  token?: string;
  refreshToken?: string;
}

export const getSavedAccounts = (): SavedAccount[] => {
  try {
    const saved = localStorage.getItem('subboard_saved_accounts');
    if (!saved) return [];
    
    const accounts = JSON.parse(saved);
    
    // 🛡️ АВТОМАТИЧЕСКАЯ ОЧИСТКА ТОКЕНОВ из существующих аккаунтов
    const cleanedAccounts = accounts.map((account: SavedAccount) => {
      const { token, refreshToken, ...cleanAccount } = account;
      if (token || refreshToken) {
        console.log(`🧹 Удаляем токены из сохраненного аккаунта: ${account.name}`);
      }
      return cleanAccount;
    });
    
    // Сохраняем очищенные аккаунты обратно
    if (cleanedAccounts.some((acc: any, index: number) => 
      accounts[index].token || accounts[index].refreshToken)) {
      localStorage.setItem('subboard_saved_accounts', JSON.stringify(cleanedAccounts));
      console.log('🛡️ Токены удалены из всех сохраненных аккаунтов для безопасности');
    }
    
    return cleanedAccounts;
  } catch (error) {
    console.error('Ошибка загрузки сохраненных аккаунтов:', error);
    return [];
  }
};

export const saveAccount = (account: SavedAccount): void => {
  try {
    const existingAccounts = getSavedAccounts();
    
    // Удаляем дубликаты по номеру телефона
    const filteredAccounts = existingAccounts.filter(acc => acc.phone !== account.phone);
    
    // Добавляем новый аккаунт в начало списка
    const updatedAccounts = [account, ...filteredAccounts].slice(0, 5); // Максимум 5 аккаунтов
    
    localStorage.setItem('subboard_saved_accounts', JSON.stringify(updatedAccounts));
  } catch (error) {
    console.error('Ошибка сохранения аккаунта:', error);
  }
};

export const removeAccount = (accountId: string): void => {
  try {
    const existingAccounts = getSavedAccounts();
    const updatedAccounts = existingAccounts.filter(acc => acc.id !== accountId);
    
    localStorage.setItem('subboard_saved_accounts', JSON.stringify(updatedAccounts));
  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error);
  }
};

export const clearAllSavedAccounts = (): void => {
  try {
    localStorage.removeItem('subboard_saved_accounts');
  } catch (error) {
    console.error('Ошибка очистки сохраненных аккаунтов:', error);
  }
};

export const hasSavedAccounts = (): boolean => {
  return getSavedAccounts().length > 0;
};

// Функция для создания тестовых аккаунтов (для разработки)
export const createTestAccounts = (): void => {
  const testAccounts: SavedAccount[] = [
    {
      id: '1',
      name: 'Андрей Малахов',
      phone: '+79135849601',
      avatar: undefined,
      lastLogin: new Date().toISOString(),
      token: undefined, // Тестовые аккаунты без токенов
      refreshToken: undefined
    },
    {
      id: '2', 
      name: 'Тестовый Пользователь',
      phone: '+79123456789',
      avatar: undefined,
      lastLogin: new Date(Date.now() - 86400000).toISOString(), // Вчера
      token: undefined,
      refreshToken: undefined
    }
  ];
  
  localStorage.setItem('subboard_saved_accounts', JSON.stringify(testAccounts));
  console.log('Созданы тестовые аккаунты:', testAccounts);
}; 