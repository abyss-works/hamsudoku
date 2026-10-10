import { useAppService } from './useAppService';
import { QueryProvider } from './queryClient';
import { EndlessGameScreen } from '../features/endless/EndlessGameScreen';
import { GameScreen } from '../features/stages/GameScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { LoginScreen } from '../features/account/LoginScreen';
import { SelectScreen } from '../features/stages/SelectScreen';
import { SetPasswordScreen } from '../features/account/SetPasswordScreen';
import { BootSplash } from '../ui/BootSplash';
import { LoadingProvider } from '../ui/LoadingProvider';
export type { Screen } from './appLogic';
export { BOOT_TIMEOUT_MS } from './appLogic';

function AppView() {
  const {
    screen, stage, chapterId, clears, sound, account, chapters, loading, error, summary,
    ready, showBootLoading, linkError, enter, handleRecord, signinThenSwitch,
    beginSwitch, cancelSignin, handleLogout, goHome, goNextMap, toggleSound,
    browse, openEndless, openLogin, home,
  } = useAppService();
  return (
    <LoadingProvider>
      <main className="app">
      {!ready ? (
        showBootLoading && <BootSplash />
      ) : (
        <>
          {screen === 'home' && (
            <HomeScreen
              email={account.email}
              nickname={account.nickname}
              uid={account.uid}
              summary={summary}
              sound={sound}
              onToggleSound={() => toggleSound()}
              onBaseChosen={beginSwitch}
              onCancelSignin={cancelSignin}
              onBrowse={() => browse()}
              onEndless={() => openEndless()}
              endlessEnabled={account.cloud}
              onWarmSession={() => void account.warmSession()}
              onSaveNickname={account.saveNickname}
              onSignup={account.signup}
              onSignin={signinThenSwitch}
              onReset={account.reset}
              onLogin={() => openLogin()}
              onLogout={handleLogout}
            />
          )}
          {screen === 'select' && (
            <SelectScreen
              chapters={chapters}
              loading={loading}
              error={error}
              clears={clears}
              initialChapterId={chapterId}
              onSelect={enter}
              onBack={() => home()}
            />
          )}
          {screen === 'game' && stage && (
            <GameScreen
              key={stage.id}
              stage={stage}
              onBack={() => browse()}
              onNextMap={goNextMap}
              onRecord={handleRecord}
            />
          )}
          {screen === 'endless' && <EndlessGameScreen onBack={() => home()} />}
          {screen === 'login' && (
            <LoginScreen
              signup={account.signup}
              signin={signinThenSwitch}
              reset={account.reset}
              cloud={account.cloud}
              onBack={() => home()}
              onDone={() => home()}
            />
          )}
          {screen === 'recovery' && (
            <SetPasswordScreen
              setPassword={account.setPassword}
              linkError={linkError}
              onDone={goHome}
            />
          )}
        </>
      )}
      </main>
    </LoadingProvider>
  );
}

export default function App() {
  return <QueryProvider><AppView /></QueryProvider>;
}
