import { useState, useMemo } from "react";
import { useConvexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { MessageSquare, HelpCircle, FileText, CheckCircle2, User, Users } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { toast } from "sonner";

type TaskRefinement = {
  _id: Id<"taskRefinements">;
  _creationTime?: number;
  taskId: Id<"tasks">;
  authorId: string;
  authorEmail: string;
  authorName?: string;
  role: "owner" | "collaborator";
  type: "note" | "question" | "answer" | "update";
  content: string;
  createdAt: number;
  updatedAt?: number;
  parentId?: Id<"taskRefinements">;
};

type TaskRefinementSectionProps = {
  taskId: Id<"tasks">;
  isOwner: boolean;
  currentUserId: string;
};

export function TaskRefinementSection({ taskId, isOwner, currentUserId }: TaskRefinementSectionProps) {
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [questionContent, setQuestionContent] = useState("");
  const [answeringQuestionId, setAnsweringQuestionId] = useState<Id<"taskRefinements"> | null>(null);
  const [answerContent, setAnswerContent] = useState("");

  // Fetch refinements with real-time updates
  const refinements = useConvexQuery(api.refinements.getTaskRefinements, { taskId }) as TaskRefinement[] | undefined;

  const addRefinement = useConvexMutation(api.refinements.addTaskRefinement);
  const answerQuestion = useConvexMutation(api.refinements.answerQuestion);

  // Group refinements: questions with their answers
  const groupedRefinements = useMemo(() => {
    if (!refinements) {
      return {
        notes: [],
        questionGroups: [],
        updates: [],
      };
    }

    const questions = refinements.filter((r) => r.type === "question");
    const answers = refinements.filter((r) => r.type === "answer");
    const notes = refinements.filter((r) => r.type === "note");
    const updates = refinements.filter((r) => r.type === "update");

    // Group questions with their answers
    const questionGroups = questions.map((question) => {
      const questionAnswers = answers.filter((answer) => answer.parentId === question._id);
      return {
        question,
        answers: questionAnswers.sort((a, b) => a.createdAt - b.createdAt),
      };
    });

    return {
      notes: notes.sort((a, b) => a.createdAt - b.createdAt),
      questionGroups: questionGroups.sort((a, b) => a.question.createdAt - b.question.createdAt),
      updates: updates.sort((a, b) => a.createdAt - b.createdAt),
    };
  }, [refinements]);

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      toast.error("Please enter a note");
      return;
    }

    try {
      await addRefinement({
        taskId,
        type: "note",
        content: noteContent.trim(),
      });
      setNoteContent("");
      setShowAddNote(false);
      toast.success("Note added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
    }
  };

  const handleAddQuestion = async () => {
    if (!questionContent.trim()) {
      toast.error("Please enter a question");
      return;
    }

    try {
      await addRefinement({
        taskId,
        type: "question",
        content: questionContent.trim(),
      });
      setQuestionContent("");
      setShowAddQuestion(false);
      toast.success("Question added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add question");
    }
  };

  const handleAnswerQuestion = async (questionId: Id<"taskRefinements">) => {
    if (!answerContent.trim()) {
      toast.error("Please enter an answer");
      return;
    }

    try {
      await answerQuestion({
        questionId,
        answer: answerContent.trim(),
      });
      setAnswerContent("");
      setAnsweringQuestionId(null);
      toast.success("Answer added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add answer");
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getAuthorDisplay = (refinement: TaskRefinement) => {
    const name = refinement.authorName || refinement.authorEmail.split("@")[0];
    const role = refinement.role === "owner" ? "Owner" : "Collaborator";
    return `${name} (${role})`;
  };

  return (
    <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Refinement
        </h3>
        <div className="flex gap-2">
          {!isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddNote(true);
                  setShowAddQuestion(false);
                }}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                Add Note
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddQuestion(true);
                  setShowAddNote(false);
                }}
                className="text-xs"
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Ask Question
              </Button>
            </>
          )}
          {isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddNote(true);
                  setShowAddQuestion(false);
                }}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                Add Note
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddQuestion(true);
                  setShowAddNote(false);
                }}
                className="text-xs"
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Ask Question
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Add Note Form */}
      {showAddNote && (
        <Card className="p-3 mb-4 bg-slate-50 dark:bg-slate-900">
          <Textarea
            placeholder="Add a note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="min-h-[80px] mb-2"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowAddNote(false); setNoteContent(""); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddNote}>
              Add Note
            </Button>
          </div>
        </Card>
      )}

      {/* Add Question Form */}
      {showAddQuestion && (
        <Card className="p-3 mb-4 bg-slate-50 dark:bg-slate-900">
          <Textarea
            placeholder="Ask a question..."
            value={questionContent}
            onChange={(e) => setQuestionContent(e.target.value)}
            className="min-h-[80px] mb-2"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowAddQuestion(false); setQuestionContent(""); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddQuestion}>
              Ask Question
            </Button>
          </div>
        </Card>
      )}

      {/* Refinements List */}
      <div className="space-y-4">
        {/* Notes */}
        {groupedRefinements.notes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Notes
            </h4>
            <div className="space-y-2">
              {groupedRefinements.notes.map((note) => (
                <Card key={note._id} className="p-3 bg-slate-50 dark:bg-slate-900">
                  <p className="text-sm text-foreground mb-2">{note.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {getAuthorDisplay(note)} • {formatTime(note.createdAt)}
                    </span>
                    <Badge variant={note.role === "owner" ? "default" : "secondary"} className="text-xs">
                      {note.role === "owner" ? <User className="h-2 w-2 mr-1" /> : <Users className="h-2 w-2 mr-1" />}
                      {note.role}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Questions & Answers */}
        {groupedRefinements.questionGroups.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Questions & Answers
            </h4>
            <div className="space-y-3">
              {groupedRefinements.questionGroups.map(({ question, answers }) => (
                <Card key={question._id} className="p-3 bg-slate-50 dark:bg-slate-900">
                  <div className="mb-2">
                    <div className="flex items-start gap-2 mb-1">
                      <HelpCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                      <p className="text-sm font-medium text-foreground flex-1">{question.content}</p>
                    </div>
                    <div className="flex items-center justify-between ml-6">
                      <span className="text-xs text-muted-foreground">
                        {getAuthorDisplay(question)} • {formatTime(question.createdAt)}
                      </span>
                      <Badge variant={question.role === "owner" ? "default" : "secondary"} className="text-xs">
                        {question.role === "owner" ? <User className="h-2 w-2 mr-1" /> : <Users className="h-2 w-2 mr-1" />}
                        {question.role}
                      </Badge>
                    </div>
                  </div>

                  {/* Answers */}
                  {answers.length > 0 && (
                    <div className="ml-6 mt-3 space-y-2 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                      {answers.map((answer) => (
                        <div key={answer._id} className="bg-white dark:bg-slate-800 rounded p-2">
                          <p className="text-sm text-foreground mb-1">{answer.content}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {getAuthorDisplay(answer)} • {formatTime(answer.createdAt)}
                            </span>
                            <Badge variant="default" className="text-xs">
                              <User className="h-2 w-2 mr-1" />
                              Owner
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Answer Form (Owner only) */}
                  {isOwner && answeringQuestionId === question._id && (
                    <div className="ml-6 mt-3 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                      <Textarea
                        placeholder="Type your answer..."
                        value={answerContent}
                        onChange={(e) => setAnswerContent(e.target.value)}
                        className="min-h-[60px] mb-2"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAnsweringQuestionId(null);
                            setAnswerContent("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleAnswerQuestion(question._id)}>
                          Answer
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Answer Button (Owner only, if no answer form is shown) */}
                  {isOwner && answeringQuestionId !== question._id && (
                    <div className="ml-6 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAnsweringQuestionId(question._id);
                          setAnswerContent("");
                        }}
                        className="text-xs"
                      >
                        {answers.length > 0 ? "Add Another Answer" : "Answer Question"}
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Updates */}
        {groupedRefinements.updates.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Updates
            </h4>
            <div className="space-y-2">
              {groupedRefinements.updates.map((update) => (
                <Card key={update._id} className="p-3 bg-slate-50 dark:bg-slate-900">
                  <p className="text-sm text-foreground mb-2">{update.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {getAuthorDisplay(update)} • {formatTime(update.createdAt)}
                    </span>
                    <Badge variant="default" className="text-xs">
                      <User className="h-2 w-2 mr-1" />
                      Owner
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!refinements || refinements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No refinements yet. Start a conversation!</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

