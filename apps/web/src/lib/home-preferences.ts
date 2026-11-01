export const HOME_NEW_SPACE_BUTTON_VISIBLE_KEY = "lumate_home_new_space_button_visible";
export const HOME_CALENDAR_VISIBLE_KEY = "lumate_home_calendar_visible";
export const HOME_PREFERENCES_CHANGED_EVENT = "lumate-home-preferences-changed";

export function isHomeNewSpaceButtonVisible(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(HOME_NEW_SPACE_BUTTON_VISIBLE_KEY) !== "false";
}

export function setHomeNewSpaceButtonVisible(visible: boolean): void {
  window.localStorage.setItem(HOME_NEW_SPACE_BUTTON_VISIBLE_KEY, String(visible));
  window.dispatchEvent(new Event(HOME_PREFERENCES_CHANGED_EVENT));
}

export function isHomeCalendarVisible(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(HOME_CALENDAR_VISIBLE_KEY) !== "false";
}

export function setHomeCalendarVisible(visible: boolean): void {
  window.localStorage.setItem(HOME_CALENDAR_VISIBLE_KEY, String(visible));
  window.dispatchEvent(new Event(HOME_PREFERENCES_CHANGED_EVENT));
}
