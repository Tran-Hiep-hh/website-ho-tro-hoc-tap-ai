CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('TEACHER', 'STUDENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED', 'INACTIVE'))
);

CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));

CREATE TABLE refresh_tokens (
    refresh_token_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX refresh_tokens_session_unique ON refresh_tokens (session_id);

CREATE TABLE source_documents (
    document_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(user_id),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('PDF', 'DOCX', 'TXT')),
    storage_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extracted_text TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING'
        CHECK (status IN ('PROCESSING', 'READY', 'FAILED', 'DELETED'))
);

CREATE TABLE generated_contents (
    revision INTEGER NOT NULL DEFAULT 1,
    generation_settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(user_id),
    content_type VARCHAR(20) NOT NULL
        CHECK (content_type IN ('QUIZ', 'FLASHCARD', 'MINDMAP')),
    title VARCHAR(255) NOT NULL,
    difficulty VARCHAR(20) NOT NULL
        CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'READY', 'FAILED', 'DELETED'))
);

CREATE TABLE content_sources (
    content_id BIGINT NOT NULL REFERENCES generated_contents(content_id) ON DELETE CASCADE,
    document_id BIGINT NOT NULL REFERENCES source_documents(document_id),
    PRIMARY KEY (content_id, document_id)
);

CREATE TABLE quiz_versions (
    title VARCHAR(255),
    quiz_version_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES generated_contents(content_id),
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    UNIQUE (quiz_id, version_number)
);

CREATE TABLE quiz_questions (
    source_label TEXT,
    question_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quiz_version_id BIGINT NOT NULL REFERENCES quiz_versions(quiz_version_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    explanation TEXT,
    display_order INTEGER NOT NULL CHECK (display_order > 0),
    UNIQUE (quiz_version_id, display_order)
);

CREATE TABLE answer_options (
    option_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES quiz_questions(question_id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL CHECK (display_order > 0),
    UNIQUE (question_id, display_order),
    UNIQUE (option_id, question_id)
);

CREATE TABLE flashcards (
    keyword VARCHAR(100) NOT NULL DEFAULT '',
    flashcard_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES generated_contents(content_id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    display_order INTEGER NOT NULL CHECK (display_order > 0),
    UNIQUE (content_id, display_order)
);

CREATE TABLE mindmap_nodes (
    node_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES generated_contents(content_id) ON DELETE CASCADE,
    parent_node_id BIGINT REFERENCES mindmap_nodes(node_id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL CHECK (display_order > 0)
);

CREATE TABLE flashcard_progress (
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    flashcard_id BIGINT NOT NULL REFERENCES flashcards(flashcard_id) ON DELETE CASCADE,
    remembered BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, flashcard_id)
);

CREATE TABLE classrooms (
    class_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(user_id),
    class_name VARCHAR(255) NOT NULL,
    description TEXT,
    join_code VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'DELETED'))
);

CREATE TABLE join_requests (
    request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES classrooms(class_id),
    student_id BIGINT NOT NULL REFERENCES users(user_id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE UNIQUE INDEX join_requests_one_pending
    ON join_requests (class_id, student_id)
    WHERE status = 'PENDING';

CREATE TABLE class_memberships (
    membership_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES classrooms(class_id),
    student_id BIGINT NOT NULL REFERENCES users(user_id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'LEFT', 'REMOVED')),
    UNIQUE (class_id, student_id)
);

CREATE TABLE class_materials (
    class_material_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES classrooms(class_id),
    document_id BIGINT REFERENCES source_documents(document_id),
    content_id BIGINT REFERENCES generated_contents(content_id),
    CHECK (num_nonnulls(document_id, content_id) = 1)
);

CREATE UNIQUE INDEX class_materials_document_unique
    ON class_materials (class_id, document_id)
    WHERE document_id IS NOT NULL;

CREATE UNIQUE INDEX class_materials_content_unique
    ON class_materials (class_id, content_id)
    WHERE content_id IS NOT NULL;

CREATE TABLE quiz_assignments (
    assignment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES classrooms(class_id),
    quiz_version_id BIGINT NOT NULL REFERENCES quiz_versions(quiz_version_id),
    title VARCHAR(255) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
    show_answers BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (status IN ('PUBLISHED', 'CANCELLED')),
    CHECK (due_at > start_at)
);

CREATE TABLE quiz_attempts (
    attempt_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    quiz_version_id BIGINT NOT NULL REFERENCES quiz_versions(quiz_version_id),
    assignment_id BIGINT REFERENCES quiz_assignments(assignment_id),
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    started_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    score NUMERIC(5, 2) CHECK (score BETWEEN 0 AND 100),
    CHECK (
        (status = 'IN_PROGRESS' AND submitted_at IS NULL)
        OR (status = 'SUBMITTED' AND submitted_at IS NOT NULL AND score IS NOT NULL)
    )
);

CREATE UNIQUE INDEX quiz_attempts_assigned_number_unique
    ON quiz_attempts (assignment_id, user_id, attempt_number)
    WHERE assignment_id IS NOT NULL;

CREATE UNIQUE INDEX quiz_attempts_personal_number_unique
    ON quiz_attempts (user_id, quiz_version_id, attempt_number)
    WHERE assignment_id IS NULL;

CREATE TABLE attempt_answers (
    attempt_answer_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES quiz_questions(question_id),
    selected_option_id BIGINT,
    UNIQUE (attempt_id, question_id),
    FOREIGN KEY (selected_option_id, question_id)
        REFERENCES answer_options(option_id, question_id)
);

CREATE INDEX source_documents_owner_index ON source_documents (owner_id, status);
CREATE INDEX generated_contents_owner_index ON generated_contents (owner_id, content_type, status);
CREATE INDEX join_requests_class_status_index ON join_requests (class_id, status);
CREATE INDEX class_memberships_class_status_index ON class_memberships (class_id, status);
CREATE INDEX quiz_assignments_class_status_index ON quiz_assignments (class_id, status);
CREATE INDEX quiz_attempts_assignment_user_index ON quiz_attempts (assignment_id, user_id, status);
