// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useLoginService } from './useLoginService';
import { useAuthDialogService } from './useAuthDialogService';
import { useSetPasswordService } from './useSetPasswordService';
import { useNicknameService } from './useNicknameService';
import { recommendedBase, validateCredentials, validatePassword } from './forms';
afterEach(() => vi.useRealTimers());
it('validates credentials and password confirmation without IO', () => {
 expect(validateCredentials(' ', '123456')).toBe('이메일과 6자 이상 비밀번호를 입력하세요.');
 expect(validatePassword('123456', '654321')).toBe('비밀번호가 서로 달라요.');
 expect(recommendedBase({seeds: 8, clears: 0}, 8)).toBe('device');
 expect(recommendedBase({seeds: 8, clears: 0}, 9)).toBe('account');
});
it('guards duplicate signup and cancels completion timer on unmount', async () => {
 vi.useFakeTimers(); let resolve!: (r: {ok:boolean}) => void;
 const signup = vi.fn(() => new Promise<{ok:boolean}>(r => {resolve = r;})); const onDone = vi.fn();
 const {result, unmount} = renderHook(() => useLoginService({signup, signin: signup, reset: async () => ({ok:true}), cloud:true, onBack:()=>{}, onDone}));
 act(() => {result.current.setEmail(' e@x.y '); result.current.setPassword('123456');});
 let pending!: Promise<void>;
 act(() => {pending = result.current.submit(); void result.current.submit();});
 expect(signup).toHaveBeenCalledTimes(1);
 await act(async () => {resolve({ok:true}); await pending;});
 expect(result.current.okMessage).toBe('계정이 만들어졌다!');
 act(() => vi.advanceTimersByTime(699)); expect(onDone).not.toHaveBeenCalled();
 unmount(); act(() => vi.advanceTimersByTime(1)); expect(onDone).not.toHaveBeenCalled();
});
it('holds existing account until basis confirmation and keeps opening guest snapshot', async () => {
 const signin = vi.fn(async () => ({ok:true})); const onBase = vi.fn();
 const options = {signup: async () => ({ok:false,code:'email_exists'}), signin, reset:async()=>({ok:true}), guest:{seeds:8, clears:2}, fetchAccountSeeds:async()=>9, onBase,onBack:()=>{},onDone:()=>{}};
 const {result, rerender} = renderHook((p) => useAuthDialogService(p), {initialProps:options});
 act(() => {result.current.setEmail('e@x.y');result.current.setPassword('123456');});
 await act(async () => {await result.current.submit();});
 expect(result.current.chooseBase).toBe(true); expect(onBase).not.toHaveBeenCalled();
 rerender({...options, guest:{seeds:0,clears:0}});
 expect(result.current.guestSnapshot?.seeds).toBe(8);
 act(() => result.current.selectBase('device')); expect(result.current.pendingBase).toBe('device');
 expect(signin).toHaveBeenCalledTimes(1);
 await act(async () => {await result.current.confirmBase();});
 expect(onBase).toHaveBeenCalledWith('device'); expect(signin).toHaveBeenCalledTimes(2);
});
it('shows nickname failure and restores the submission state', async () => {
 const onEnter=vi.fn();
 const {result}=renderHook(()=>useNicknameService({onSaveNickname:async()=>({ok:false,msg:'저장 오류'}),onEnter}));
 act(()=>result.current.setDraft('햄찌'));
 await act(async()=>{await result.current.save();});
 expect(result.current.msg).toBe('저장 오류');expect(result.current.saving).toBe(false);expect(onEnter).not.toHaveBeenCalled();
});
it('completes password success after 700ms', async () => {
 vi.useFakeTimers(); const onDone=vi.fn();
 const {result}=renderHook(()=>useSetPasswordService({setPassword:async()=>({ok:true}),linkError:false,onDone}));
 act(()=>{result.current.setPw('123456'); result.current.setConfirm('123456');});
 await act(async()=>{await result.current.submit();});
 act(()=>vi.advanceTimersByTime(700));expect(onDone).toHaveBeenCalledOnce();
});
import { homeGate, selectionModel, rankModel } from './screenModels';
it('chooses gates before endless entry and selects fallback chapter',()=>{
 expect(homeGate(true,'guest',null,null)).toBe('guest');
 expect(homeGate(true,'account','e@x.y',null)).toBe('nickname');
 expect(homeGate(true,'account','e@x.y','햄찌')).toBe('enter');
 const chapters=[{id:'c',title:'1',stages:[]}];
 expect(selectionModel(chapters,'missing',new Map()).active?.id).toBe('c');
 expect(rankModel(null,null,null,false).entries).toEqual([]);
});
import { useHomeService } from './useHomeService';
it('refreshes home quietly and opens guest gate before requesting entry',()=>{
 const refreshSoft=vi.fn(async()=>null);const refreshMyRank=vi.fn(async()=>{});const onEndless=vi.fn();
 const options={email:null,nickname:null,uid:'guest',summary:{me:null,rank:null,myRank:null,loading:false,error:null,refresh:async()=>{},refreshSoft,refreshMyRank},sound:true,onToggleSound:()=>{},onSaveNickname:async()=>({ok:true}),onSignup:async()=>({ok:true}),onSignin:async()=>({ok:true}),onReset:async()=>({ok:true}),onBrowse:()=>{},onEndless,endlessEnabled:true,onWarmSession:()=>{},onLogin:()=>{},onLogout:()=>{}};
 const {result}=renderHook(()=>useHomeService(options));
 expect(refreshSoft).toHaveBeenCalledOnce();
 act(()=>result.current.enterEndless());expect(result.current.guestGateOpen).toBe(true);expect(onEndless).not.toHaveBeenCalled();
 act(()=>result.current.openRank());expect(result.current.rankOpen).toBe(true);expect(refreshSoft).toHaveBeenCalledTimes(2);expect(refreshMyRank).toHaveBeenCalledOnce();
});
it('preserves login error and allows retry after failure',async()=>{
 const signin=vi.fn(async()=>({ok:false,msg:'로그인 오류'}));
 const {result}=renderHook(()=>useLoginService({signup:async()=>({ok:false,code:'email_exists'}),signin,reset:async()=>({ok:true}),cloud:true,onBack:()=>{},onDone:()=>{}}));
 act(()=>{result.current.setEmail('e@x.y');result.current.setPassword('123456');});
 await act(async()=>{await result.current.submit();});expect(result.current.confirmLogin).toBe(true);
 await act(async()=>{await result.current.login();});expect(result.current.error).toBe('로그인 오류');expect(result.current.busy).toBe(false);
});
it('ignores completion after unmount while signup is pending',async()=>{
 vi.useFakeTimers();let resolve!:(value:{ok:boolean})=>void;const onDone=vi.fn();
 const {result,unmount}=renderHook(()=>useAuthDialogService({signup:()=>new Promise(r=>{resolve=r;}),signin:async()=>({ok:true}),reset:async()=>({ok:true}),guest:null,onBack:()=>{},onDone}));
 act(()=>{result.current.setEmail('e@x.y');result.current.setPassword('123456');});
 let pending!:Promise<void>;act(()=>{pending=result.current.submit();});unmount();
 await act(async()=>{resolve({ok:true});await pending;});act(()=>vi.advanceTimersByTime(700));expect(onDone).not.toHaveBeenCalled();
});
it('recovers nickname submission after rejected request',async()=>{
 const {result}=renderHook(()=>useNicknameService({onSaveNickname:async()=>{throw Error('offline');}}));
 await act(async()=>{await result.current.save();});expect(result.current.msg).toBe('저장하지 못했어요.');expect(result.current.saving).toBe(false);
});
import { existingEmail, validateResetEmail } from './forms';
it('classifies existing-email responses and reset input',()=>{
 expect(existingEmail('email_exists')).toBe(true);expect(existingEmail('user_already_exists')).toBe(true);expect(existingEmail('offline')).toBe(false);
 expect(validateResetEmail(' ')).toBe(false);expect(validateResetEmail(' e@x.y ')).toBe(true);
});
it('uses latest account summary from a retained home callback',async()=>{
 const base: Parameters<typeof useHomeService>[0]={email:null,nickname:null,uid:'guest',summary:{me:null,rank:null,myRank:null,loading:false,error:null,refresh:async()=>{},refreshSoft:async()=>null,refreshMyRank:async()=>{}},sound:true,onToggleSound:()=>{},onSaveNickname:async()=>({ok:true}),onSignup:async()=>({ok:true}),onSignin:async()=>({ok:true}),onReset:async()=>({ok:true}),onBrowse:()=>{},onEndless:()=>{},endlessEnabled:true,onWarmSession:()=>{},onLogin:()=>{},onLogout:()=>{}};
 const fresh=vi.fn(async()=>({wallet:{balance:42},clearedCount:0,streak:{current:0,best:0},season:'2026-W41'}));
 const {result,rerender}=renderHook(p=>useHomeService(p),{initialProps:base});
 const previous=result.current.fetchAccountSeeds;
 rerender({...base,summary:{...base.summary,refreshSoft:fresh}});
 expect(await previous()).toBe(42);
});
it('fetches account seeds through latest callback after pending signin',async()=>{
 let resolve!:(value:{ok:boolean})=>void;
 const options={signup:async()=>({ok:false,code:'email_exists'}),signin:()=>new Promise<{ok:boolean}>(r=>{resolve=r;}),reset:async()=>({ok:true}),guest:{seeds:1,clears:0},fetchAccountSeeds:async()=>1,onBack:()=>{},onDone:()=>{}};
 const {result,rerender}=renderHook(p=>useAuthDialogService(p),{initialProps:options});
 act(()=>{result.current.setEmail('e@x.y');result.current.setPassword('123456');});
 let pending!:Promise<void>;await act(async()=>{pending=result.current.submit();await Promise.resolve();});
 rerender({...options,fetchAccountSeeds:async()=>42});
 await act(async()=>{resolve({ok:true});await pending;});expect(result.current.accountSeeds).toBe(42);
});
