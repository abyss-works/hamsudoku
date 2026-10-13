import { useAppService } from './core/orchestration/useAppService';
import { QueryProvider } from './core/QueryProvider';
import { useDelayedLoading } from './core/orchestration/useDelayedLoading';
import { EndlessScene } from './core/composition/EndlessScene';
import { StageScene } from './core/composition/StageScene';
import { HomeScene } from './core/composition/HomeScene';
import { LoginScreen } from './presentation/views/account/LoginScreen';
import { SelectScreen } from './presentation/views/stages/SelectScreen';
import { SetPasswordScreen } from './presentation/views/account/SetPasswordScreen';
import { BootSplash } from './presentation/ui/BootSplash';
import { LoadingProvider } from './core/composition/LoadingProvider';
export type { Screen } from './core/orchestration/appLogic';
export { BOOT_TIMEOUT_MS } from './core/orchestration/appLogic';

function AppView() {
  const {
    screen, stage, chapterId, clears, sound, account, chapters, loading, error, summary,
    ready, showBootLoading, linkError, enter, handleRecord, signinThenSwitch,
    beginSwitch, cancelSignin, handleLogout, goHome, goNextMap, toggleSound,
    browse, openEndless, openLogin, home,
  } = useAppService();
  const showSelectLoading = useDelayedLoading(loading);
  return (
    <LoadingProvider>
      <main className="app">
      {!ready ? (
        showBootLoading && <BootSplash />
      ) : (
        <>
          {screen === 'home' && (
            <HomeScene
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
              showLoading={showSelectLoading}
              error={error}
              clears={clears}
              initialChapterId={chapterId}
              onSelect={enter}
              onBack={() => home()}
            />
          )}
          {screen === 'game' && stage && (
            <StageScene
              key={stage.id}
              stage={stage}
              onBack={() => browse()}
              onNextMap={goNextMap}
              onRecord={handleRecord}
            />
          )}
          {screen === 'endless' && <EndlessScene onBack={() => home()} />}
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
