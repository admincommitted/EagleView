import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '@/services/axiosInstance';
import { ComboInput } from '@/components/ui';
import { sharedWidgetsApi } from './common/sharedWidgetsApi';

// fetchUrl -> mapped options, shared by every box (keyed by the full API url, which the AWB screens read too)
export const dataCache = {};

const FULL_LIST_LIMIT = 50;
const MATCH_LIMIT = 30;
const ENFORCE_AFTER_BLUR_MS = 150;

const apiPathOf = (url) => (url.startsWith(`${API_BASE_URL}/`) ? url.slice(API_BASE_URL.length) : url);
const cacheKeyOf = (url) => `${API_BASE_URL}${apiPathOf(url)}`;

const upper = (text) => String(text || '').toUpperCase();

// title / search key starting with the text first, then anything that contains it
const rankedMatches = (pool, text) => {
  const typed = upper(text);
  if (!typed) return pool.slice(0, FULL_LIST_LIMIT);
  const rank = (option) => {
    if (upper(option.title).startsWith(typed)) return 0;
    return upper(option.searchKey).startsWith(typed) ? 1 : 2;
  };
  return pool
    .filter((option) => [option.title, option.subtitle, option.searchKey].some((field) => field && upper(field).includes(typed)))
    .sort((first, second) => rank(first) - rank(second))
    .slice(0, MATCH_LIMIT);
};

function OptionLine({ option }) {
  return (
    <span className="tw:flex tw:min-w-0 tw:flex-1 tw:items-baseline tw:gap-2 tw:whitespace-nowrap" title={option.subtitle ? `${option.title} - ${option.subtitle}` : option.title}>
      <span className="tw:shrink-0 tw:font-bold tw:text-foreground">{option.title}</span>
      {option.subtitle && <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-muted-foreground">{option.subtitle}</span>}
      {option.countryCode && <span className="tw:ml-auto tw:shrink-0 tw:text-[11px] tw:text-muted-foreground">{option.countryCode}</span>}
    </span>
  );
}

function useOptionPool(fetchUrl, staticData, mapData) {
  const [loaded, setLoaded] = useState(() => (fetchUrl ? dataCache[cacheKeyOf(fetchUrl)] : null));

  useEffect(() => {
    if (staticData || !fetchUrl) return undefined;
    const cacheKey = cacheKeyOf(fetchUrl);
    if (dataCache[cacheKey]) {
      setLoaded(dataCache[cacheKey]);
      return undefined;
    }
    let isCurrent = true;
    const load = async () => {
      try {
        const answer = await sharedWidgetsApi.listFrom(apiPathOf(fetchUrl));
        const mapped = mapData(Array.isArray(answer) ? answer : (answer.data || []));
        dataCache[cacheKey] = mapped;
        if (isCurrent) setLoaded(mapped);
      } catch (error) {
        console.error('CustomAutocomplete prefetch error:', error);
      }
    };
    load();
    return () => { isCurrent = false; };
  }, [fetchUrl, staticData]); // eslint-disable-line react-hooks/exhaustive-deps -- mapData is a new function on every render

  return staticData || loaded || [];
}

/**
 * Upper-case text box with a list of { title, subtitle, searchKey, countryCode } options, from staticData or read
 * once from fetchUrl (mapData turns the answer into options). onChange gets { target: { value, name } }.
 * enforceSelection: on leaving the box a text that is not an option becomes the best match, or is cleared.
 */
export default function CustomAutocomplete({
  defaultValue,
  value,
  enforceSelection,
  onChange,
  onSelect,
  fetchUrl,
  staticData,
  mapData,
  placeholder,
  style,
  maxLength,
  name,
}) {
  const [text, setText] = useState(value !== undefined ? (value || '') : (defaultValue || ''));
  const textRef = useRef(text);
  const pool = useOptionPool(fetchUrl, staticData, mapData);
  const options = useMemo(() => rankedMatches(pool, text), [pool, text]);

  useEffect(() => {
    if (value === undefined) return;
    setText(value || '');
    textRef.current = value || '';
  }, [value]);

  const changeText = (nextText) => {
    setText(nextText);
    textRef.current = nextText;
    onChange?.({ target: { value: nextText, name } });
  };

  const handleType = (typed) => {
    if (maxLength && typed.length > maxLength) return;
    changeText(typed);
  };

  const handleSelect = (option) => {
    changeText(option.title);
    onSelect?.(option);
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented || !textRef.current || !options.length) return;
    event.preventDefault();
    handleSelect(options[0]);
  };

  const handleBlur = () => {
    if (!enforceSelection) return;
    setTimeout(() => {
      const typed = textRef.current;
      if (!typed) return;
      if (pool.some((option) => option.title && upper(option.title) === upper(typed))) return;
      const best = rankedMatches(pool, typed);
      if (best.length) handleSelect(best[0]);
      else changeText('');
    }, ENFORCE_AFTER_BLUR_MS);
  };

  return (
    <ComboInput
      options={options}
      value={text}
      onValueChange={handleType}
      onSelect={handleSelect}
      getValue={(option) => option.title}
      filter={() => true}
      limit={FULL_LIST_LIMIT}
      upper
      renderOption={(option) => <OptionLine option={option} />}
      name={name}
      placeholder={placeholder}
      maxLength={maxLength}
      style={style}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="tw:w-full"
      listClassName="tw:w-[max(var(--radix-popover-trigger-width),360px)] tw:max-w-[calc(100vw-16px)]"
    />
  );
}
