"use client";

import { useEffect, useState } from "react";
import { useOnlineUsers } from "@/lib/presence/useOnlineUsers";

export default function OnlineUsersDropdown() {
  const onlineUsers = useOnlineUsers();
  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    if (!showOnline) return;

    const handleClick = () => setShowOnline(false);
    window.addEventListener("click", handleClick);

    return () => window.removeEventListener("click", handleClick);
  }, [showOnline]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        setShowOnline((prev) => !prev);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          setShowOnline((prev) => !prev);
        }
        if (event.key === "Escape") {
          setShowOnline(false);
        }
      }}
      className="relative flex cursor-pointer items-center gap-2 text-sm text-white/90"
      aria-expanded={showOnline}
      aria-haspopup="listbox"
    >
      <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
      {onlineUsers.length} online

      {showOnline ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-border bg-white p-2 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="listbox"
          aria-label="Online users"
        >
          <div className="mb-2 text-xs text-gray-500">
            Online users ({onlineUsers.length})
          </div>

          {onlineUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 py-1 text-sm text-primary"
              role="option"
            >
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
              {user.name}
            </div>
          ))}

          {onlineUsers.length === 0 ? (
            <div className="text-sm text-gray-400">No users online</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
