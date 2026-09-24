import { redirect } from 'next/navigation'

// The standalone Activity page was retired (handoff 7): per-project activity now
// lives inside the home Projects section and each project's profile. Keep the URL
// working by sending it to the home Projects section.
export default function ActivityPage() {
  redirect('/#projects')
}
