type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  isOnline?: boolean;
};

export function UserAvatar({ name, avatarUrl, className = "w-9 h-9", fallbackClassName = "bg-primary/20 text-foreground", isOnline }: UserAvatarProps) {
  const initial = name?.[0]?.toUpperCase() || "?";

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${avatarUrl ? "bg-secondary" : fallbackClassName}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Foto de ${name}`} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-sm font-bold">{initial}</span>
        )}
      </div>
      {isOnline && (
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background shadow-sm" />
      )}
    </div>
  );
}
