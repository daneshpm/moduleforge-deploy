import React, { useState } from 'react';
import { Video } from 'lucide-react';
import { Team } from '../../types';
import { MeetingInvite } from './MeetingInvite';

interface TeamMeetButtonProps {
  team: Team;
  variant?: 'primary' | 'outline' | 'compact';
  className?: string;
}

export const TeamMeetButton: React.FC<TeamMeetButtonProps> = ({
  team,
  variant = 'outline',
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const buttonClasses = {
    primary:
      'px-4 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95',
    outline:
      'px-4 py-2.5 rounded-xl bg-white border border-[#E2E6E4] hover:bg-[#EAF3EF] hover:border-[#1F5E4B]/40 text-[#202524] text-xs font-bold shadow-xs flex items-center gap-2 transition',
    compact:
      'p-2 rounded-xl bg-white border border-[#E2E6E4] hover:bg-[#EAF3EF] hover:border-[#1F5E4B]/40 text-[#202524] transition shadow-xs',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`${buttonClasses[variant]} ${className}`}
        title={`Start a meeting in ${team.name}`}
      >
        <Video className="w-4 h-4 text-[#1F5E4B]" />
        {variant !== 'compact' && <span>Meet 🎥</span>}
      </button>

      {isModalOpen && (
        <MeetingInvite
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          team={team}
        />
      )}
    </>
  );
};
