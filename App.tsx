
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, AppSettings, Screen, Winner, Language, AppNotification, ActiveInvestment, TransactionRequest } from './types';
import { getTranslation } from './translations';
import Dashboard from './components/Dashboard';
import Wallet from './components/Wallet';
import DailyRewards from './components/DailyRewards';
import ScratchWin from './components/ScratchWin';
import OneRupeeGame from './components/OneRupeeGame';
import AdminPanel from './components/AdminPanel';
import Registration from './components/Registration';
import Referral from './components/Referral';
import EditProfile from './components/EditProfile';
import { Home, Wallet as WalletIcon, Settings, User, Trophy, Languages, X, ShieldAlert, Volume2, LogOut } from 'lucide-react';
import { speak } from './services/ttsService';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('pak_finance_lang');
    return (saved as Language) || 'ur';
  });
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.REGISTRATION);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [cloudUsers, setCloudUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('pak_finance_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [cloudRequests, setCloudRequests] = useState<TransactionRequest[]>(() => {
    const saved = localStorage.getItem('pak_finance_requests');
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<UserProfile>({
    name: '',
    cnic: '',
    address: '',
    phone: '',
    walletBalance: 2500,
    withdrawableBalance: 0,
    isRegistered: false,
    isAdmin: false,
    activeInvestments: [],
    referralCode: '',
    referralCount: 0,
    referralEarnings: 0,
    hasMadeFirstInvestment: false,
    hasMadeFirstDeposit: false
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pak_finance_settings');
    return saved ? JSON.parse(saved) : {
      dailyProfitPercentage: 15,
      scratchCardPrice: 50,
      scratchWinProbability: 0.3,
      referralBonus: 50,
      adminEasyPaisaName: 'Tauseef Haider',
      adminEasyPaisaNumber: '03040007495',
      adminJazzCashName: 'Tauseef Haider',
      adminJazzCashNumber: '03040007495',
      adRewardAmount: 5,
      adUrl: 'https://www.google.com',
      globalAnnouncement: 'خوش آمدید! آج کے بہترین منافع والے پلانز دیکھنا نہ بھولیں۔'
    };
  });

  const [winners, setWinners] = useState<Winner[]>([
    { id: '1', name: 'محمد احمد', cnic: '35201-XXXXXXX-X', address: 'لاہور', date: '2024-05-20', prize: 'iPhone 15' },
    { id: '2', name: 'سارہ خان', cnic: '42101-XXXXXXX-X', address: 'کراچی', date: '2024-05-19', prize: 'Rs. 10,000' }
  ]);

  const t = useMemo(() => getTranslation(language), [language]);
  const isRtl = language === 'ur';

  const handleSpeak = async (text: string) => {
    setIsSpeaking(true);
    await speak(text);
    setIsSpeaking(false);
  };

  // Heartbeat to update last active status
  useEffect(() => {
    if (user.isRegistered) {
        const heartbeat = setInterval(() => {
            setUser(prev => ({ ...prev, lastActive: new Date().toISOString() }));
        }, 1000 * 60 * 5); // Every 5 mins
        return () => clearInterval(heartbeat);
    }
  }, [user.isRegistered]);

  useEffect(() => {
    localStorage.setItem('pak_finance_lang', language);
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRtl]);

  useEffect(() => {
    const initVoice = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        handleSpeak(language === 'ur' ? "پاک فنانس میں خوش آمدید۔" : "Welcome to Pak Finance."); 
        window.removeEventListener('click', initVoice);
      }
    };
    window.addEventListener('click', initVoice);
    return () => window.removeEventListener('click', initVoice);
  }, [hasInteracted, language]);

  useEffect(() => {
    localStorage.setItem('pak_finance_users', JSON.stringify(cloudUsers));
  }, [cloudUsers]);

  useEffect(() => {
    localStorage.setItem('pak_finance_requests', JSON.stringify(cloudRequests));
  }, [cloudRequests]);

  useEffect(() => {
    localStorage.setItem('pak_finance_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (user.isRegistered) {
      setCloudUsers(prev => {
        const index = prev.findIndex(u => u.phone === user.phone);
        const updatedUser = { ...user };
        if (index === -1) return [...prev, updatedUser];
        if (JSON.stringify(prev[index]) === JSON.stringify(updatedUser)) return prev;
        const newUsers = [...prev];
        newUsers[index] = updatedUser;
        return newUsers;
      });
    }
  }, [user]);

  const handleLogout = () => {
    setUser({
      name: '',
      cnic: '',
      address: '',
      phone: '',
      walletBalance: 0,
      withdrawableBalance: 0,
      isRegistered: false,
      isAdmin: false,
      activeInvestments: [],
      referralCode: '',
      referralCount: 0,
      referralEarnings: 0,
      hasMadeFirstInvestment: false,
      hasMadeFirstDeposit: false
    });
    setCurrentScreen(Screen.REGISTRATION);
    addNotification("Logged out successfully", "info");
  };

  const processRequest = useCallback((requestId: string, status: 'approved' | 'rejected') => {
    const req = cloudRequests.find(r => r.id === requestId);
    if (!req) return;

    const updatedRequests = cloudRequests.map(r => r.id === requestId ? { ...r, status } : r);
    setCloudRequests(updatedRequests);

    if (status === 'approved') {
      setCloudUsers(prev => {
        let referrerToReward: string | null = null;
        const intermediateUsers = prev.map(u => {
          if (u.phone === req.userPhone) {
            if (req.type === 'deposit') {
              const isFirstDeposit = !u.hasMadeFirstDeposit;
              if (isFirstDeposit && u.referredBy) {
                referrerToReward = u.referredBy;
              }
              const updated = { 
                ...u, 
                walletBalance: u.walletBalance + req.amount,
                hasMadeFirstDeposit: true 
              };
              if (user.phone === u.phone) setUser(updated);
              return updated;
            }
          }
          return u;
        });

        if (referrerToReward) {
          return intermediateUsers.map(u => {
            if (u.referralCode === referrerToReward) {
              const updated = {
                ...u,
                withdrawableBalance: u.withdrawableBalance + settings.referralBonus,
                referralEarnings: u.referralEarnings + settings.referralBonus,
                referralCount: u.referralCount + 1
              };
              if (user.phone === u.phone) setUser(updated);
              return updated;
            }
            return u;
          });
        }
        return intermediateUsers;
      });
    } else if (status === 'rejected' && req.type === 'withdraw') {
      setCloudUsers(prev => {
        return prev.map(u => {
          if (u.phone === req.userPhone) {
            const updated = { ...u, withdrawableBalance: u.withdrawableBalance + req.amount };
            if (user.phone === u.phone) setUser(updated);
            return updated;
          }
          return u;
        });
      });
    }
  }, [cloudRequests, settings.referralBonus, user.phone]);

  const submitTransactionRequest = useCallback((request: Partial<TransactionRequest>) => {
    const fullRequest: TransactionRequest = {
      id: Date.now().toString(),
      userId: user.phone,
      userName: user.name,
      userPhone: user.phone,
      status: 'pending',
      timestamp: new Date().toISOString(),
      type: 'deposit',
      amount: 0,
      method: 'easyPaisa',
      ...request
    } as TransactionRequest;

    setCloudRequests(prev => [fullRequest, ...prev]);
    if (fullRequest.type === 'withdraw') {
      setUser(prev => ({ ...prev, withdrawableBalance: prev.withdrawableBalance - (fullRequest.amount || 0) }));
    }
  }, [user.phone, user.name]);

  const onUpdateProfile = (updatedProfile: Partial<UserProfile>) => {
    if (updatedProfile.phone && updatedProfile.phone !== user.phone) {
        setCloudUsers(prev => prev.filter(u => u.phone !== user.phone));
    }
    setUser(prev => ({ ...prev, ...updatedProfile }));
    addNotification("Profile updated successfully", "success");
    setCurrentScreen(Screen.DASHBOARD);
  };

  const addNotification = useCallback((message: string, type: 'success' | 'info' | 'reward' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const updateBalance = (amount: number, type: 'wallet' | 'withdrawable' = 'wallet') => {
    setUser(prev => ({ 
      ...prev, 
      [type === 'wallet' ? 'walletBalance' : 'withdrawableBalance']: prev[type === 'wallet' ? 'walletBalance' : 'withdrawableBalance'] + amount 
    }));
  };

  const investInPlan = (planId: string, amount: number) => {
    if (user.walletBalance < amount) {
      addNotification(t.insufficient_balance, 'info');
      return;
    }
    const investedAt = new Date();
    const nextClaimAt = new Date(investedAt.getTime() + 24 * 60 * 60 * 1000); 
    const newInvestment: ActiveInvestment = {
      id: Date.now().toString(),
      planId,
      investedAt: investedAt.toISOString(),
      nextClaimAt: nextClaimAt.toISOString(),
      isClaimed: false,
      isMatured: false
    };
    setUser(prev => ({
      ...prev,
      walletBalance: prev.walletBalance - amount,
      activeInvestments: [...prev.activeInvestments, newInvestment],
      hasMadeFirstInvestment: true
    }));
    addNotification(t.plan_purchased, 'success');
  };

  const claimProfit = (investmentId: string, profit: number, principal: number, isMatured: boolean) => {
    setUser(prev => ({
      ...prev,
      withdrawableBalance: prev.withdrawableBalance + profit,
      walletBalance: isMatured ? prev.walletBalance + principal : prev.walletBalance,
      activeInvestments: prev.activeInvestments.map(inv => 
        inv.id === investmentId ? { ...inv, isClaimed: true, isMatured: true } : inv
      )
    }));
    addNotification(t.notif_reward.replace('{amount}', profit.toLocaleString()), 'reward');
  };

  const onLogin = (userData: UserProfile) => {
    setUser(userData);
    setCurrentScreen(Screen.DASHBOARD);
  };

  const onRegisterUser = (userData: UserProfile) => {
    setCloudUsers(prev => [...prev, userData]);
    setUser(userData);
    setCurrentScreen(Screen.DASHBOARD);
  };

  const toggleLanguage = () => {
    if (language === 'ur') setLanguage('en');
    else if (language === 'en') setLanguage('roman');
    else setLanguage('ur');
  };

  const renderScreen = () => {
    const commonProps = { t, language, addNotification };
    switch (currentScreen) {
      case Screen.REGISTRATION:
        return (
          <Registration 
            {...commonProps} 
            cloudUsers={cloudUsers}
            onLogin={onLogin}
            onRegister={onRegisterUser}
            setCloudUsers={setCloudUsers}
            handleSpeak={handleSpeak}
            setLanguage={setLanguage}
          />
        );
      case Screen.DASHBOARD:
        return <Dashboard {...commonProps} user={user} settings={settings} updateBalance={updateBalance} onNavigate={setCurrentScreen} onLogout={handleLogout} />;
      case Screen.WALLET:
        return (
          <Wallet 
            {...commonProps} 
            user={user} 
            settings={settings}
            updateBalance={updateBalance} 
            submitRequest={submitTransactionRequest}
            onBack={() => setCurrentScreen(Screen.DASHBOARD)} 
            handleSpeak={handleSpeak}
          />
        );
      case Screen.DAILY_REWARDS:
        return (
          <DailyRewards 
            {...commonProps} 
            user={user} 
            settings={settings} 
            investInPlan={investInPlan}
            claimProfit={claimProfit}
            onBack={() => setCurrentScreen(Screen.DASHBOARD)} 
            updateBalance={updateBalance}
          />
        );
      case Screen.SCRATCH_WIN:
        return <ScratchWin {...commonProps} user={user} settings={settings} updateBalance={updateBalance} onBack={() => setCurrentScreen(Screen.DASHBOARD)} />;
      case Screen.ONE_RUPEE_GAME:
        return <OneRupeeGame {...commonProps} user={user} winners={winners} updateBalance={updateBalance} onBack={() => setCurrentScreen(Screen.DASHBOARD)} handleAdReward={(amt) => updateBalance(amt, 'withdrawable')} />;
      case Screen.ADMIN:
        return (
          <AdminPanel 
            {...commonProps} 
            settings={settings} 
            setSettings={setSettings} 
            winners={winners} 
            setWinners={setWinners} 
            requests={cloudRequests}
            processRequest={processRequest}
            cloudUsers={cloudUsers}
            setCloudUsers={setCloudUsers}
            onBack={() => setCurrentScreen(Screen.DASHBOARD)} 
          />
        );
      case Screen.REFERRAL:
        return <Referral {...commonProps} user={user} settings={settings} onBack={() => setCurrentScreen(Screen.DASHBOARD)} />;
      case Screen.EDIT_PROFILE:
        return <EditProfile {...commonProps} user={user} onUpdate={onUpdateProfile} onBack={() => setCurrentScreen(Screen.DASHBOARD)} />;
      default:
        return <Dashboard {...commonProps} user={user} settings={settings} updateBalance={updateBalance} onNavigate={setCurrentScreen} onLogout={handleLogout} />;
    }
  };

  const isAuthScreen = currentScreen === Screen.REGISTRATION;

  return (
    <div className={`max-w-md mx-auto min-h-screen app-bg flex flex-col relative overflow-hidden ${isRtl ? 'urdu-font' : 'font-sans'}`}>
      {isSpeaking && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-1 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 animate-pulse">
           <Volume2 className="text-white" size={16} />
           <div className="flex gap-0.5">
             <div className="w-1 h-3 bg-white/60 rounded-full animate-[bounce_1s_infinite]"></div>
             <div className="w-1 h-5 bg-white/80 rounded-full animate-[bounce_1s_infinite_0.1s]"></div>
             <div className="w-1 h-2 bg-white/40 rounded-full animate-[bounce_1s_infinite_0.2s]"></div>
           </div>
        </div>
      )}

      <div className="fixed top-20 left-0 right-0 z-[100] px-4 pointer-events-none flex flex-col gap-2 max-w-md mx-auto">
        {notifications.map(notif => (
          <div 
            key={notif.id}
            className={`pointer-events-auto flex items-center gap-3 p-4 rounded-3xl shadow-2xl animate-in slide-in-from-top-4 duration-300 border-l-4 glass ${
              notif.type === 'reward' ? 'border-yellow-500 text-yellow-900' :
              notif.type === 'success' ? 'border-green-500 text-green-900' :
              'border-blue-500 text-blue-900'
            }`}
          >
            <div className="flex-1 text-sm font-black">{notif.message}</div>
            {/* Fix: Use notif.id correctly instead of undefined id */}
            <button onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {!isAuthScreen && user.isRegistered && (
        <header className={`glass ${user.isAdmin ? 'border-amber-400' : 'border-white/30'} text-emerald-900 p-4 flex justify-between items-center z-20 sticky top-0 shadow-lg mx-3 mt-3 rounded-2xl transition-all`}>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setCurrentScreen(Screen.EDIT_PROFILE)}
                className={`w-10 h-10 ${user.isAdmin ? 'bg-amber-500' : 'bg-emerald-600'} rounded-2xl flex items-center justify-center text-white shadow-lg overflow-hidden group relative`}
             >
               {user.profilePicture ? (
                 <img src={user.profilePicture} className="w-full h-full object-cover" alt="Profile" />
               ) : (
                 user.isAdmin ? <ShieldAlert size={20} /> : <User size={20} />
               )}
               <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <Settings size={12} />
               </div>
             </button>
             <div>
               <h1 className="text-sm font-black tracking-tight">{user.name}</h1>
               <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{user.phone}</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleLanguage} className="bg-emerald-50 text-emerald-700 p-2 rounded-xl flex items-center gap-1 hover:bg-emerald-100 transition-colors border border-emerald-100">
              <Languages size={14} />
              <span className="text-[9px] font-black uppercase">{language}</span>
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 bg-red-50 text-red-600 rounded-xl border border-red-100 active:scale-90 transition-all"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>
      )}

      <main className={`flex-1 ${!isAuthScreen ? 'pb-24' : ''} overflow-y-auto`}>
        {renderScreen()}
      </main>

      {!isAuthScreen && user.isRegistered && (
        <nav className="fixed bottom-4 left-4 right-4 max-w-md mx-auto glass border border-white/40 flex justify-around items-center py-4 z-20 shadow-2xl rounded-3xl">
          <button onClick={() => setCurrentScreen(Screen.DASHBOARD)} className={`flex flex-col items-center gap-1.5 ${currentScreen === Screen.DASHBOARD ? 'text-emerald-700 scale-110' : 'text-gray-400'} transition-all`}>
            <Home size={22} strokeWidth={currentScreen === Screen.DASHBOARD ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-widest">{t.home}</span>
          </button>
          <button onClick={() => setCurrentScreen(Screen.WALLET)} className={`flex flex-col items-center gap-1.5 ${currentScreen === Screen.WALLET ? 'text-emerald-700 scale-110' : 'text-gray-400'} transition-all`}>
            <WalletIcon size={22} strokeWidth={currentScreen === Screen.WALLET ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-widest">{t.wallet}</span>
          </button>
          <div className="w-px h-6 bg-gray-200"></div>
          <button onClick={() => setCurrentScreen(Screen.ONE_RUPEE_GAME)} className={`flex flex-col items-center gap-1.5 ${currentScreen === Screen.ONE_RUPEE_GAME ? 'text-emerald-700 scale-110' : 'text-gray-400'} transition-all`}>
            <Trophy size={22} strokeWidth={currentScreen === Screen.ONE_RUPEE_GAME ? 3 : 2} />
            <span className="text-[9px] font-black uppercase tracking-widest">{t.game}</span>
          </button>
          {user.isAdmin && (
            <button onClick={() => setCurrentScreen(Screen.ADMIN)} className={`flex flex-col items-center gap-1.5 ${currentScreen === Screen.ADMIN ? 'text-amber-600 scale-110' : 'text-gray-400'} transition-all`}>
              <Settings size={22} strokeWidth={currentScreen === Screen.ADMIN ? 3 : 2} />
              <span className="text-[9px] font-black uppercase tracking-widest">{t.admin}</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
};

export default App;
