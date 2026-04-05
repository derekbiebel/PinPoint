import { useState } from 'react';
import { getApiKey, setApiKey, hasValidKey } from '../lib/oddsApi';
import { clearAllBets } from '../lib/betTracker';

export default function Settings({ open, onClose, onKeyChange }) {
  const currentKey = getApiKey();
  const masked = currentKey ? currentKey.slice(0, 6) + '...' + currentKey.slice(-4) : '';
  const [newKey, setNewKey] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!open) return null;

  const handleSaveKey = (e) => {
    e.preventDefault();
    const trimmed = newKey.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setNewKey('');
    onKeyChange();
  };

  const handleRemoveKey = () => {
    localStorage.removeItem('pinpoint_api_key');
    setShowRemoveConfirm(false);
    onKeyChange();
  };

  const handleClearBets = () => {
    clearAllBets();
    setShowClearConfirm(false);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* API Key section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </h3>
            {currentKey ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    {masked}
                  </span>
                  {showRemoveConfirm ? (
                    <span className="flex gap-2">
                      <button
                        onClick={handleRemoveKey}
                        className="text-xs text-red-500 hover:underline font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowRemoveConfirm(false)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowRemoveConfirm(true)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveKey} className="flex gap-2">
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Replace with new key"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={!newKey.trim()}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No key set. You'll be prompted to enter one.
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Each person uses their own free key (500 req/month) from the-odds-api.com
            </p>
          </section>

          {/* Data section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Data
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Phantom bankroll history
              </span>
              {showClearConfirm ? (
                <span className="flex gap-2">
                  <button
                    onClick={handleClearBets}
                    className="text-xs text-red-500 hover:underline font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear all bets
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
