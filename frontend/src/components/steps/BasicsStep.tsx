'use client';

import { ProjectFormData, PROJECT_CATEGORIES, ValidationErrors } from '@/types/project';

interface BasicsStepProps {
  data: ProjectFormData;
  errors: ValidationErrors;
  onChange: (field: keyof ProjectFormData, value: any) => void;
}

export default function BasicsStep({ data, errors, onChange }: BasicsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Project Basics</h2>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s start with the fundamentals of your project. Give it a compelling title and description.
        </p>
      </div>

      {/* Project Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
          Project Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={data.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="e.g., Revolutionary Solar-Powered Water Purifier"
          className={`w-full px-4 py-3 bg-background border rounded-md focus:outline-none focus:ring-2 transition-all text-foreground placeholder:text-muted-foreground ${
            errors.title 
              ? 'border-red-500 focus:ring-red-400 focus:border-red-500' 
              : 'border-border focus:ring-ring focus:border-ring'
          }`}
          maxLength={100}
        />
        <div className="flex justify-between mt-1">
          <div>
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.title.length}/100
          </p>
        </div>
      </div>

      {/* Project Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
          Project Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Describe your project in detail. What problem does it solve? What makes it unique? Who will benefit from it?"
          rows={8}
          className={`w-full px-4 py-3 bg-background border rounded-md focus:outline-none focus:ring-2 transition-all resize-none text-foreground placeholder:text-muted-foreground ${
            errors.description 
              ? 'border-red-500 focus:ring-red-400 focus:border-red-500' 
              : 'border-border focus:ring-ring focus:border-ring'
          }`}
          maxLength={2000}
        />
        <div className="flex justify-between mt-1">
          <div>
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.description.length}/2000
          </p>
        </div>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-foreground mb-2">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          value={data.category}
          onChange={(e) => onChange('category', e.target.value)}
          className={`w-full px-4 py-3 bg-background border rounded-md focus:outline-none focus:ring-2 transition-all text-foreground ${
            errors.category 
              ? 'border-red-500 focus:ring-red-400 focus:border-red-500' 
              : 'border-border focus:ring-ring focus:border-ring'
          }`}
        >
          <option value="">Select a category</option>
          {PROJECT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="text-sm text-red-500 mt-1">{errors.category}</p>
        )}
      </div>

      {/* Image URL (Optional) */}
      <div>
        <label htmlFor="imageUrl" className="block text-sm font-medium text-foreground mb-2">
          Project Image URL <span className="text-muted-foreground text-xs">(Optional)</span>
        </label>
        <input
          type="url"
          id="imageUrl"
          value={data.imageUrl}
          onChange={(e) => onChange('imageUrl', e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full px-4 py-3 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Provide a URL to an image that represents your project
        </p>
      </div>
    </div>
  );
}
