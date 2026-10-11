// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { cloudAuthApi } from '../account/accountApi';
import { QueryProvider } from '../../core/queryClient';
import { useAdminRankPanelService } from './useAdminRankPanelService';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('waits for admin identity before loading account ranking',async()=>{
 let resolve!:(value:{uid:string;email:string;cloud:boolean})=>void;
 vi.spyOn(cloudAuthApi,'me').mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const request=vi.fn(async()=>Response.json({season:'s',entries:[{userId:'g',nickname:null,score:3}]}));vi.stubGlobal('fetch',request);
 const {result}=renderHook(()=>useAdminRankPanelService(),{wrapper:QueryProvider});
 expect(request).not.toHaveBeenCalled();
 await act(async()=>{resolve({uid:'admin',email:'a@x.y',cloud:true});});
 await waitFor(()=>expect(result.current.guestEntries).toHaveLength(1));
});
