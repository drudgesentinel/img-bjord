import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'admin_show_post_usernames';

const initialValue =
  browser && localStorage.getItem(STORAGE_KEY) === '1';

const { subscribe, set: internalSet } = writable(initialValue);

function setAdminShowPostUsernames(enabled: boolean) {
  internalSet(enabled);

  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

export const adminShowPostUsernames = {
  subscribe,
  set: setAdminShowPostUsernames
};
