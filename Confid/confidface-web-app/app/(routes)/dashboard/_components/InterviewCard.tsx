import React from 'react'
import { interviewData } from '../../interview/[interviewId]/start/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
    interviewInfo:interviewData
}

function InterviewCard({interviewInfo}: Props) {
  const router = useRouter()
  
  const handleFeedbackClick = () => {
    router.push(`/interview/${interviewInfo._id}/feedback`)
  }
  
  return (
    <div className='p-4 border rounded-xl'>
      <h2 className='font-semibold text-xl flex justify-between items-center'>{interviewInfo?.resumeUrl?'Resume Interview': interviewInfo.jobTitle}
         <Badge>{interviewInfo?.status}</Badge>
      </h2>
      <p className='line-clamp-2 text-gray-500'>{interviewInfo?.resumeUrl?'We generated interview from the uploaded resume.': interviewInfo.jobDescription}</p>

        <div className='mt-5 flex justify-between items-center'>
           {interviewInfo?.feedback && <Button onClick={handleFeedbackClick}>Feedback</Button> }
            <Link href={'/interview/'+interviewInfo._id}>         
                <Button className='' variant={'outline'}>Start Interview <ArrowRight /></Button>
            </Link>
        </div>
    
    </div>
  )
}

export default InterviewCard
