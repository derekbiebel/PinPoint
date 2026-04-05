// TODO: wire to Action Network or Betsperts API when available

export default function SharpMoneyBar() {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
        <span>Public vs Sharp</span>
        <span className="italic">Public data unavailable</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className="h-full w-1/2 bg-gray-300 dark:bg-gray-600 rounded-full" />
      </div>
    </div>
  );
}
